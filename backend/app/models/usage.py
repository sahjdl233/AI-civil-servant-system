from sqlalchemy import Column, String, Integer, DateTime
from datetime import datetime
from app.db.database import Base


class TokenUsage(Base):
    """Token 消耗统计：每行 = 一次真实的 LLM API 调用。"""

    __tablename__ = "token_usage"

    id = Column(String, primary_key=True, index=True)
    provider_id = Column(String, index=True)  # AiProvider.id（或 seed-default）
    provider_name = Column(String, nullable=False)  # 显示名，冗余快照
    provider_type = Column(String(50), nullable=True)
    model = Column(String(100), nullable=True)
    scene = Column(String(50), index=True)  # qtype_detection|diagnosis|evaluation|...
    prompt_tokens = Column(Integer, default=0, nullable=False)
    completion_tokens = Column(Integer, default=0, nullable=False)
    total_tokens = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
