from sqlalchemy import Column, String, DateTime, Float
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.types import JSON as SA_JSON
from datetime import datetime
from app.db.database import Base, DATABASE_URL


def _json_type():
    # Prefer JSONB on Postgres; fall back to generic JSON for SQLite/others
    if DATABASE_URL.startswith("sqlite"):
        return SA_JSON()
    return JSONB()


class History(Base):
    __tablename__ = "history"

    id = Column(String, primary_key=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    kind = Column(String, nullable=False, index=True)
    question_type = Column(String, nullable=True)
    score = Column(Float, nullable=True)
    request_json = Column(_json_type(), nullable=False)
    response_json = Column(_json_type(), nullable=False)
    extra_json = Column(_json_type(), nullable=True)
