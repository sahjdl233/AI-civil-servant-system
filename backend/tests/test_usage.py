from datetime import datetime, timedelta
import uuid

from app.db.database import SessionLocal
from app.models.usage import TokenUsage
from app.services import usage_service
from app.services.providers.base import LLMUsage


def _insert_usage(
    *,
    provider_name: str,
    prompt: int,
    completion: int,
    scene: str = "diagnosis",
    provider_id: str = "p1",
    provider_type: str = "openai",
    model: str = "gpt-4o",
    created_at: datetime = None,
) -> None:
    with SessionLocal() as db:
        db.add(
            TokenUsage(
                id=str(uuid.uuid4()),
                provider_id=provider_id,
                provider_name=provider_name,
                provider_type=provider_type,
                model=model,
                scene=scene,
                prompt_tokens=prompt,
                completion_tokens=completion,
                total_tokens=prompt + completion,
                created_at=created_at or datetime.utcnow(),
            )
        )
        db.commit()


def test_get_stats_groups_by_provider():
    _insert_usage(provider_name="GPT", prompt=1000, completion=500)
    _insert_usage(provider_name="GPT", prompt=2000, completion=1000)
    _insert_usage(provider_name="Claude", prompt=3000, completion=2000)
    _insert_usage(provider_name="Claude", prompt=500, completion=500, scene="test")

    stats = usage_service.get_stats(range_key="today", group_by="provider", exclude_test=True)
    assert stats["summary"]["callCount"] == 3
    assert stats["summary"]["promptTokens"] == 6000
    assert stats["summary"]["completionTokens"] == 3500
    assert stats["summary"]["totalTokens"] == 9500

    by_name = {i["providerName"]: i for i in stats["items"]}
    assert by_name["GPT"]["totalTokens"] == 4500
    assert by_name["GPT"]["callCount"] == 2
    assert by_name["Claude"]["totalTokens"] == 5000
    assert by_name["Claude"]["callCount"] == 1


def test_get_stats_exclude_test_false():
    _insert_usage(provider_name="GPT", prompt=100, completion=100)
    _insert_usage(provider_name="GPT", prompt=50, completion=50, scene="test")

    without_test = usage_service.get_stats(range_key="today", exclude_test=True)
    assert without_test["summary"]["callCount"] == 1

    with_test = usage_service.get_stats(range_key="today", exclude_test=False)
    assert with_test["summary"]["callCount"] == 2


def test_get_stats_range_filtering():
    _insert_usage(provider_name="GPT", prompt=100, completion=100)  # 今天
    _insert_usage(
        provider_name="GPT",
        prompt=200,
        completion=200,
        created_at=datetime.utcnow() - timedelta(days=1),
    )
    _insert_usage(
        provider_name="GPT",
        prompt=400,
        completion=400,
        created_at=datetime.utcnow() - timedelta(days=10),
    )

    today = usage_service.get_stats(range_key="today")
    assert today["summary"]["totalTokens"] == 200

    yesterday = usage_service.get_stats(range_key="yesterday")
    assert yesterday["summary"]["totalTokens"] == 400

    d7 = usage_service.get_stats(range_key="7d")
    assert d7["summary"]["totalTokens"] == 200 + 400

    all_ = usage_service.get_stats(range_key="all")
    assert all_["summary"]["totalTokens"] == 200 + 400 + 800

    bad = usage_service.get_stats(range_key="not-a-range")
    assert bad["range"] == "today"


def test_get_stats_group_by_scene():
    _insert_usage(provider_name="GPT", prompt=100, completion=100, scene="diagnosis")
    _insert_usage(provider_name="GPT", prompt=200, completion=200, scene="diagnosis")
    _insert_usage(provider_name="GPT", prompt=300, completion=300, scene="evaluation")

    stats = usage_service.get_stats(range_key="today", group_by="scene")
    by_scene = {i["scene"]: i for i in stats["items"]}
    assert by_scene["diagnosis"]["callCount"] == 2
    assert by_scene["diagnosis"]["totalTokens"] == 600
    assert by_scene["evaluation"]["totalTokens"] == 600


def test_get_stats_estimated_cost():
    with SessionLocal() as db:
        db.add(
            __import__("app.models.provider", fromlist=["AiProvider"]).AiProvider(
                id="cost-p",
                name="GPT-成本",
                provider_type="openai",
                api_key="enc:test",
                model="gpt-4o",
                extra={"cost_per_1k_input": 0.005, "cost_per_1k_output": 0.015},
            )
        )
        db.commit()

    _insert_usage(provider_name="GPT-成本", prompt=1000, completion=1000)

    stats = usage_service.get_stats(range_key="today")
    item = stats["items"][0]
    assert item["providerName"] == "GPT-成本"
    # 1k prompt * 0.005 + 1k completion * 0.015 = 0.005 + 0.015
    assert item["estimatedCost"] == 0.02


def test_estimated_cost_missing_price():
    # 未配置单价的 Provider：estimatedCost 为 None，Token 汇总不受影响
    _insert_usage(provider_name="无单价", prompt=100, completion=100)

    stats = usage_service.get_stats(range_key="today")
    item = stats["items"][0]
    assert item["providerName"] == "无单价"
    assert item["estimatedCost"] is None
