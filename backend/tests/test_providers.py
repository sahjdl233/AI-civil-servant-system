from app.services.provider_service import mask_api_key
from app.services.providers import ADAPTERS
from app.services.grading.orchestrator import build_aggregate


def test_mask_api_key():
    assert mask_api_key("sk-abcdef123456") == "sk-***3456"
    assert mask_api_key("short") == "***"
    assert mask_api_key("") == ""
    assert mask_api_key(None) == ""


def test_adapters_cover_all_types():
    assert set(ADAPTERS.keys()) == {"openai", "claude", "gemini", "deepseek", "qwen", "custom"}


def test_aggregate_mixed_status():
    results = [
        {"provider": {"id": "a", "name": "A"}, "status": "success", "score": 80.0},
        {"provider": {"id": "b", "name": "B"}, "status": "success", "score": 90.0},
        {"provider": {"id": "c", "name": "C"}, "status": "error", "message": "boom"},
    ]
    agg = build_aggregate(results)
    assert agg["hasScore"] is True
    assert agg["avgScore"] == 85.0
    assert agg["maxScore"] == 90.0
    assert agg["minScore"] == 80.0
    assert agg["diff"] == 10.0
    assert agg["count"] == 2
    # 失败项不进入榜单
    assert [r["providerId"] for r in agg["rankings"]] == ["b", "a"]


def test_aggregate_all_failed():
    results = [
        {"provider": {"id": "a", "name": "A"}, "status": "error"},
        {"provider": {"id": "b", "name": "B"}, "status": "error"},
    ]
    agg = build_aggregate(results)
    assert agg["hasScore"] is False
