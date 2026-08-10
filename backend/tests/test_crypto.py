import app.core.crypto as crypto
from app.core.crypto import decrypt_secret, encrypt_secret, is_encrypted
from app.services.provider_service import mask_api_key


def test_encrypt_decrypt_roundtrip():
    plain = "sk-real-secret-1234567890"
    enc = encrypt_secret(plain)
    assert enc != plain
    assert is_encrypted(enc)
    assert decrypt_secret(enc) == plain


def test_empty_values_pass_through():
    assert encrypt_secret(None) is None
    assert encrypt_secret("") == ""
    assert decrypt_secret(None) is None
    assert is_encrypted("") is False


def test_plaintext_legacy_fallback(monkeypatch):
    """SECRET_KEY 未配置时降级明文，且历史明文可被解密函数原样返回。"""
    monkeypatch.setattr(crypto, "_fernet", None)
    from app.core.config import settings

    settings._env_cache["SECRET_KEY"] = ""
    assert encrypt_secret("sk-plain") == "sk-plain"
    assert decrypt_secret("sk-plain") == "sk-plain"
    assert is_encrypted("sk-plain") is False
    settings._env_cache["SECRET_KEY"] = "test-secret-key-for-unit-tests"
    crypto._fernet = None


def test_mask_uses_decrypted_value():
    """脱敏应基于解密后的真实密钥，而不是密文。"""
    plain = "sk-abcdef1234567890"
    enc = encrypt_secret(plain)
    assert enc != plain
    assert mask_api_key(enc) != mask_api_key(plain)  # 对密文脱敏无意义
    assert mask_api_key(decrypt_secret(enc)) == mask_api_key(plain) == "sk-***7890"
