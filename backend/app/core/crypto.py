"""Provider 密钥加密工具。

使用 Fernet（对称加密）基于 SECRET_KEY 派生密钥，对 api_key 加密后落库，
即使数据库被导出/误提交，密钥也不会明文泄露。SECRET_KEY 仅存在于 .env
（已被 .gitignore 排除），不会进入 git。

未配置 SECRET_KEY 时自动降级为明文存储（保持旧部署兼容）。
"""

import base64
import hashlib

from cryptography.fernet import Fernet

_fernet: Fernet | None = None


def _get_fernet() -> Fernet | None:
    global _fernet
    if _fernet is not None:
        return _fernet
    from app.core.config import settings

    secret = (settings.SECRET_KEY or "").strip()
    if not secret:
        return None
    key = base64.urlsafe_b64encode(hashlib.sha256(secret.encode("utf-8")).digest())
    _fernet = Fernet(key)
    return _fernet


def is_encrypted(value: str) -> bool:
    """判断一段存储值是否为 Fernet 密文（用于明文迁移检测）。"""
    if not value:
        return False
    f = _get_fernet()
    if f is None:
        return False
    try:
        f.extract_timestamp(value.encode("utf-8"))
        return True
    except Exception:
        return False


def encrypt_secret(value: str | None) -> str | None:
    if not value:
        return value
    f = _get_fernet()
    if f is None:
        return value
    return f.encrypt(value.encode("utf-8")).decode("utf-8")


def decrypt_secret(value: str | None) -> str | None:
    if not value:
        return value
    f = _get_fernet()
    if f is None:
        return value
    try:
        return f.decrypt(value.encode("utf-8")).decode("utf-8")
    except Exception:
        # 历史明文或密钥更换导致的解析失败：原样返回，保证读路径不崩溃
        return value
