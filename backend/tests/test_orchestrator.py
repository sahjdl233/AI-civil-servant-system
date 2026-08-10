import json
import pytest

from app.services.providers.base import BaseLLMProvider, ProviderChatResult
from app.services.grading.orchestrator import grade_multi_stream


class MockProvider(BaseLLMProvider):
    """id='ok' 走演示模式返回结果；id='fail' 的 chat 直接抛错。"""

    def __init__(self, provider_id, name, fail=False, **kw):
        super().__init__(
            id=provider_id,
            name=name,
            provider_type="custom",
            model="mock-model",
            base_url="https://mock.example.com/v1",
            api_key="sk-test-key-placeholder" if not fail else "sk-real-key",
            timeout=30,
            extra={},
        )
        self._fail = fail

    async def chat(self, messages, **kwargs):
        if self._fail:
            raise RuntimeError("mock provider boom")
        return ProviderChatResult(
            content=json.dumps(
                {
                    "dimensions": {},
                    "summary": "诊断完成",
                    "teacher_comments": "专家诊断意见",
                },
                ensure_ascii=False,
            )
        )


class FakeRegistry:
    def __init__(self, providers):
        self._providers = {p.id: p for p in providers}

    async def get(self, provider_id):
        if provider_id not in self._providers:
            from app.services.providers import ProviderNotFoundError

            raise ProviderNotFoundError(provider_id)
        return self._providers[provider_id]

    async def get_default(self):
        return next(iter(self._providers.values()))


async def _collect(content, provider_ids, registry):
    async def fake_detect(content, question_type=None):
        return "概括题", "heuristic"

    import app.services.grading.orchestrator as orch

    orig_registry = orch.ProviderRegistry.get_instance
    orig_detect = orch.detect_question_type
    orch.ProviderRegistry.get_instance = lambda: registry
    orch.detect_question_type = fake_detect
    try:
        events = []
        async for evt in grade_multi_stream(content, None, provider_ids):
            events.append(evt)
        return events
    finally:
        orch.ProviderRegistry.get_instance = orig_registry
        orch.detect_question_type = orig_detect


@pytest.mark.asyncio
async def test_single_provider_success():
    ok = MockProvider("p_ok", "OK模型")
    events = await _collect("内容", ["p_ok"], FakeRegistry([ok]))
    types = [e["type"] for e in events]
    assert "model_result" in types
    assert "done" in types
    done = [e for e in events if e["type"] == "done"][0]
    assert done["aggregate"]["hasScore"] is True
    assert done["results"][0]["status"] == "success"


@pytest.mark.asyncio
async def test_failure_isolated():
    ok = MockProvider("p_ok", "OK模型")
    fail = MockProvider("p_fail", "失败模型", fail=True)
    events = await _collect("内容", ["p_ok", "p_fail"], FakeRegistry([ok, fail]))
    statuses = {
        e.get("provider", {}).get("id"): e.get("status")
        for e in events
        if e["type"] in ("model_result", "model_error")
    }
    assert statuses["p_ok"] == "success"
    assert statuses["p_fail"] == "error"
    done = [e for e in events if e["type"] == "done"][0]
    # 汇总只统计成功项
    assert done["aggregate"]["count"] == 1
    assert done["aggregate"]["maxScore"] == done["results"][0]["score"]


@pytest.mark.asyncio
async def test_invalid_provider_id_reported():
    ok = MockProvider("p_ok", "OK模型")
    events = await _collect("内容", ["p_ok", "ghost"], FakeRegistry([ok]))
    started = [e for e in events if e["type"] == "models_started"][0]
    assert started["invalidIds"] == ["ghost"]
    assert started["providerIds"] == ["p_ok"]


@pytest.mark.asyncio
async def test_default_fallback_when_empty():
    ok = MockProvider("p_ok", "OK模型")
    events = await _collect("内容", [], FakeRegistry([ok]))
    started = [e for e in events if e["type"] == "models_started"][0]
    assert started["providerIds"] == ["p_ok"]
