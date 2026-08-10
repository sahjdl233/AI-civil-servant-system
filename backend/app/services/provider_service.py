#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Provider 管理服务：数据库 CRUD、默认互斥、密钥脱敏、启动种子。

对外返回 dict（无密钥），供 API 端点直接响应。
"""

import logging
import time
import uuid
from datetime import datetime
from typing import List, Optional

from app.core.config import settings
from app.core.crypto import decrypt_secret, encrypt_secret, is_encrypted
from app.db.database import SessionLocal
from app.models.provider import AiProvider
from app.services.providers import ProviderRegistry, ProviderNotFoundError

logger = logging.getLogger(__name__)

VALID_TYPES = ["openai", "claude", "gemini", "deepseek", "qwen", "custom"]
PLACEHOLDER_KEYS = {
    "sk-test-key-placeholder",
    "你的OpenAI密钥",
    "your-openai-api-key",
    "sk-your-openai-api-key-here",
}


def mask_api_key(key: Optional[str]) -> str:
    """密钥脱敏：保留前 3 位与后 4 位。"""
    if not key:
        return ""
    if len(key) <= 8:
        return "***"
    return f"{key[:3]}***{key[-4:]}"


def _to_public(row: AiProvider) -> dict:
    return {
        "id": row.id,
        "name": row.name,
        "provider_type": row.provider_type,
        "base_url": row.base_url,
        "model": row.model,
        "is_default": bool(row.is_default),
        "is_enabled": bool(row.is_enabled),
        "timeout": row.timeout,
        "extra": row.extra,
        "api_key_masked": mask_api_key(decrypt_secret(row.api_key)),
        "created_at": row.created_at.isoformat() if row.created_at else None,
        "updated_at": row.updated_at.isoformat() if row.updated_at else None,
    }


def _clear_default(db) -> None:
    """将全部 Provider 的 is_default 置为 False（互斥）。"""
    db.query(AiProvider).update({AiProvider.is_default: False})


def list_providers() -> List[dict]:
    with SessionLocal() as db:
        rows = db.query(AiProvider).order_by(AiProvider.created_at.asc()).all()
        return [_to_public(r) for r in rows]


def create_provider(data: dict) -> dict:
    if data.get("provider_type") not in VALID_TYPES:
        raise ValueError("provider_type 不合法")
    provider_id = str(uuid.uuid4())
    with SessionLocal() as db:
        if data.get("is_default"):
            _clear_default(db)
        row = AiProvider(
            id=provider_id,
            name=data["name"],
            provider_type=data["provider_type"],
            base_url=data.get("base_url") or None,
            api_key=encrypt_secret(data["api_key"]),
            model=data["model"],
            is_default=bool(data.get("is_default", False)),
            is_enabled=bool(data.get("is_enabled", True)),
            timeout=int(data.get("timeout", 180)),
            extra=data.get("extra") or None,
        )
        # 若当前表为空，自动设为默认
        if db.query(AiProvider).count() == 0:
            row.is_default = True
        db.add(row)
        db.commit()
        db.refresh(row)
        return _to_public(row)


def update_provider(provider_id: str, data: dict) -> dict:
    with SessionLocal() as db:
        row = db.query(AiProvider).filter(AiProvider.id == provider_id).first()
        if not row:
            raise KeyError(f"Provider 不存在: {provider_id}")

        if "name" in data and data["name"] is not None:
            row.name = data["name"]
        if "provider_type" in data and data["provider_type"] is not None:
            if data["provider_type"] not in VALID_TYPES:
                raise ValueError("provider_type 不合法")
            row.provider_type = data["provider_type"]
        if "base_url" in data:
            row.base_url = data["base_url"] or None
        if "api_key" in data and data["api_key"]:
            row.api_key = encrypt_secret(data["api_key"])
        if "model" in data and data["model"] is not None:
            row.model = data["model"]
        if "is_enabled" in data and data["is_enabled"] is not None:
            row.is_enabled = bool(data["is_enabled"])
        if "timeout" in data and data["timeout"] is not None:
            row.timeout = int(data["timeout"])
        if "extra" in data and data["extra"] is not None:
            row.extra = data["extra"]
        if data.get("is_default"):
            _clear_default(db)
            row.is_default = True
        row.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(row)
        return _to_public(row)


def delete_provider(provider_id: str) -> None:
    with SessionLocal() as db:
        row = db.query(AiProvider).filter(AiProvider.id == provider_id).first()
        if not row:
            raise KeyError(f"Provider 不存在: {provider_id}")
        if row.is_default:
            raise ValueError("不允许删除默认 Provider，请先切换默认模型")
        db.delete(row)
        db.commit()


async def test_provider(provider_id: str) -> dict:
    """连通性测试：发一条极短的对话请求。"""
    registry = ProviderRegistry.get_instance()
    try:
        provider = await registry.get(provider_id)
    except ProviderNotFoundError as e:
        raise KeyError(str(e))

    start = time.time()
    try:
        result = await provider.chat(
            [{"role": "user", "content": "请回复：OK"}],
            temperature=0.0,
            max_tokens=8,
            timeout=30,
        )
        latency = int((time.time() - start) * 1000)
        return {"ok": True, "message": "连接成功", "latency_ms": latency}
    except Exception as e:
        latency = int((time.time() - start) * 1000)
        return {"ok": False, "message": f"连接失败: {str(e)[:200]}", "latency_ms": latency}


def ensure_seeded() -> None:
    """启动种子：Provider 表为空且环境变量可用时，写入一条默认 Provider。"""
    with SessionLocal() as db:
        count = db.query(AiProvider).count()
        if count > 0:
            return
        key = settings.openai_api_key
        if not key or key in PLACEHOLDER_KEYS:
            return
        base = settings.openai_api_base or ""
        if "deepseek" in base:
            ptype = "deepseek"
        elif "kkyyxx" in base or "volces" in base:
            ptype = "custom"
        else:
            ptype = "openai"
        row = AiProvider(
            id=str(uuid.uuid4()),
            name=settings.openai_model_name or "默认模型",
            provider_type=ptype,
            base_url=base or None,
            api_key=encrypt_secret(key),
            model=settings.openai_model_name or "gpt-4o-mini",
            is_default=True,
            is_enabled=True,
            timeout=180,
            extra={"capabilities": {"supports_reasoning": False}},
        )
        db.add(row)
        db.commit()
        logger.info("已从环境变量种子创建默认 Provider: %s", row.name)


def migrate_plaintext_keys() -> int:
    """把历史明文 api_key 加密落库（幂等）。返回迁移行数。"""
    migrated = 0
    with SessionLocal() as db:
        for row in db.query(AiProvider).all():
            if row.api_key and not is_encrypted(row.api_key):
                row.api_key = encrypt_secret(row.api_key)
                row.updated_at = datetime.utcnow()
                migrated += 1
        if migrated:
            db.commit()
            logger.info("已加密 %d 条历史明文 Provider 密钥", migrated)
    return migrated


async def invalidate_registry() -> None:
    await ProviderRegistry.get_instance().invalidate()
