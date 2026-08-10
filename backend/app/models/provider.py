from sqlalchemy import Column, String, Boolean, Integer, DateTime
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.types import JSON as SA_JSON
from datetime import datetime
from app.db.database import Base, DATABASE_URL


def _json_type():
    # Prefer JSONB on Postgres; fall back to generic JSON for SQLite/others
    if DATABASE_URL.startswith("sqlite"):
        return SA_JSON()
    return JSONB()


class AiProvider(Base):
    """AI Provider 配置：一个 Provider 对应一个厂商 + 一个模型。"""

    __tablename__ = "ai_providers"

    id = Column(String, primary_key=True, index=True)
    name = Column(String(100), nullable=False, index=True)  # 显示名，如 GPT-5 / DeepSeek V3
    provider_type = Column(String(50), nullable=False, index=True)  # openai|claude|gemini|deepseek|qwen|custom
    base_url = Column(String(500), nullable=True)  # OpenAI 兼容端点或厂商 endpoint
    api_key = Column(String(500), nullable=False)  # 密钥（接口层脱敏）
    model = Column(String(100), nullable=False)  # 模型名
    is_default = Column(Boolean, default=False, nullable=False)  # 默认模型（互斥）
    is_enabled = Column(Boolean, default=True, nullable=False)  # 是否对用户可见可选
    timeout = Column(Integer, default=180, nullable=False)  # 请求超时（秒）
    extra = Column(_json_type(), nullable=True)  # { temperature, max_tokens, capabilities, headers }
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, nullable=False)
