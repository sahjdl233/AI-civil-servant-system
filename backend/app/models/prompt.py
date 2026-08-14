from sqlalchemy import Column, String, Boolean, Integer, DateTime, Text, UniqueConstraint
from datetime import datetime
from app.db.database import Base


class PromptTemplate(Base):
    """Prompt 模板主表：一个模板对应一个 key 与一个分类。"""

    __tablename__ = "prompt_templates"
    __table_args__ = (UniqueConstraint("key", name="uq_prompt_templates_key"),)

    id = Column(String, primary_key=True, index=True)
    key = Column(String(100), nullable=False, index=True)  # 机器标识，如 coach_prompt
    name = Column(String(100), nullable=False)  # 显示名，如 Coach Prompt
    category = Column(String(50), nullable=False, index=True)  # detection|diagnosis|evaluation|grader|coach|standard_answer|consensus|knowledge
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)  # 停用后运行时忽略
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class PromptVersion(Base):
    """Prompt 版本快照表：不可变，版本号模板内自增，至多一个生效。"""

    __tablename__ = "prompt_versions"
    __table_args__ = (UniqueConstraint("template_id", "version", name="uq_prompt_versions_template_version"),)

    id = Column(String, primary_key=True, index=True)
    template_id = Column(String, nullable=False, index=True)  # FK -> prompt_templates.id
    version = Column(Integer, nullable=False)
    content = Column(Text, nullable=False)  # 完整 Prompt 快照（含 {{变量}} 占位符）
    change_note = Column(Text, nullable=True)
    is_published = Column(Boolean, default=False, nullable=False)  # 是否当前生效版本
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
