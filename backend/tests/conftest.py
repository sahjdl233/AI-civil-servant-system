import asyncio
import os

import pytest
from sqlalchemy.engine import make_url

# 在导入 app 模块前确保使用 SQLite。
os.environ.setdefault("DATABASE_URL", "sqlite:////tmp/pytest_provider.db")

# app.core.config 的 reload_env() 会执行 load_dotenv(override=True)，
# 并按 config.py 的调用栈向上搜索到 /workspace/backend/.env，
# 从而把 DATABASE_URL 覆盖回 Postgres。测试必须与 .env 隔离，
# 因此在这里禁用 dotenv 加载，保证测试始终跑在 SQLite 上。
import dotenv

dotenv.load_dotenv = lambda *args, **kwargs: False


@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(autouse=True)
def _clean_db():
    from app.db.database import Base, engine
    from app.models import provider, history  # noqa: F401

    # 安全护栏：测试只能在 SQLite 上运行，绝不允许触碰真实数据库
    assert make_url(engine.url).get_backend_name() == "sqlite", (
        f"测试禁止使用非 SQLite 数据库: {engine.url}"
    )
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)
