"""验证三个 Provider 适配器从厂商原始响应解析 usage 的单元测试。"""

import asyncio
from types import SimpleNamespace

import pytest

from app.services.providers.openai_compat import OpenAICompatProvider
from app.services.providers.anthropic import AnthropicProvider
from app.services.providers.gemini import GeminiProvider
from app.services.providers.base import LLMUsage

# 屏蔽适配器内的异步落库钩子，专注验证解析逻辑
_marker = []


def _noop_record_usage(self, raw, scene, usage):
    if usage is not None:
        _marker.append(usage)


@pytest.fixture(autouse=True)
def _patch_record(monkeypatch):
    from app.services.providers import base as base_mod

    monkeypatch.setattr(base_mod.BaseLLMProvider, "_record_usage", _noop_record_usage)
    _marker.clear()


def _make_client(response):
    """构造 OpenAI 兼容适配器并 mock 其 HTTP 客户端。"""
    provider = OpenAICompatProvider(
        id="p",
        name="GPT",
        provider_type="openai",
        model="gpt-4o",
        base_url="https://api.openai.com/v1",
        api_key="sk-test",
    )

    async def _fake_build_client():
        async def _create(**kwargs):
            return response

        return SimpleNamespace(
            chat=SimpleNamespace(completions=SimpleNamespace(create=_create))
        )

    async def _build():
        return await _fake_build_client()

    provider._build_client = _build
    return provider


@pytest.mark.asyncio
async def test_openai_compat_parses_usage():
    usage = SimpleNamespace(prompt_tokens=1300, completion_tokens=900, total_tokens=2200)
    response = SimpleNamespace(
        choices=[SimpleNamespace(message=SimpleNamespace(content="ok", reasoning_content=None))],
        usage=usage,
    )
    provider = _make_client(response)
    result = await provider.chat([{"role": "user", "content": "hi"}], scene="diagnosis")
    assert result.usage == LLMUsage(prompt_tokens=1300, completion_tokens=900, total_tokens=2200)
    assert len(_marker) == 1
    assert _marker[0].total_tokens == 2200


@pytest.mark.asyncio
async def test_openai_compat_missing_usage():
    # 部分中转站不返回 usage：适配器不崩溃，usage 为 None，不记录
    response = SimpleNamespace(
        choices=[SimpleNamespace(message=SimpleNamespace(content="ok", reasoning_content=None))],
        usage=None,
    )
    provider = _make_client(response)
    result = await provider.chat([{"role": "user", "content": "hi"}])
    assert result.usage is None
    assert _marker == []


@pytest.mark.asyncio
async def test_anthropic_parses_usage():
    provider = AnthropicProvider(
        id="p",
        name="Claude",
        provider_type="claude",
        model="claude-3-5-sonnet",
        base_url="https://api.anthropic.com",
        api_key="sk-test",
    )
    result = SimpleNamespace(status_code=200)
    data = {
        "content": [{"type": "text", "text": "hi"}],
        "usage": {"input_tokens": 500, "output_tokens": 300},
    }

    class _FakeClient:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return False

        async def post(self, *a, **kw):
            return _FakeResp(data)

    class _FakeResp:
        def __init__(self, data):
            self._data = data
            self.status_code = 200
            self.text = ""

        def json(self):
            return self._data

    import httpx

    monkeypatch = pytest.MonkeyPatch()
    monkeypatch.setattr(httpx, "AsyncClient", lambda **kw: _FakeClient())
    try:
        result = await provider.chat([{"role": "user", "content": "hi"}], scene="evaluation")
    finally:
        monkeypatch.undo()

    assert result.usage == LLMUsage(prompt_tokens=500, completion_tokens=300, total_tokens=800)
    assert len(_marker) == 1


@pytest.mark.asyncio
async def test_gemini_parses_usage():
    provider = GeminiProvider(
        id="p",
        name="Gemini",
        provider_type="gemini",
        model="gemini-1.5-pro",
        base_url="https://generativelanguage.googleapis.com",
        api_key="sk-test",
    )
    data = {
        "candidates": [{"content": {"parts": [{"text": "hi"}]}}],
        "usageMetadata": {"promptTokenCount": 700, "candidatesTokenCount": 400},
    }

    class _FakeClient:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return False

        async def post(self, *a, **kw):
            return _FakeResp(data)

    class _FakeResp:
        def __init__(self, data):
            self._data = data
            self.status_code = 200
            self.text = ""

        def json(self):
            return self._data

    import httpx

    monkeypatch = pytest.MonkeyPatch()
    monkeypatch.setattr(httpx, "AsyncClient", lambda **kw: _FakeClient())
    try:
        result = await provider.chat([{"role": "user", "content": "hi"}])
    finally:
        monkeypatch.undo()

    assert result.usage == LLMUsage(prompt_tokens=700, completion_tokens=400, total_tokens=1100)
    assert len(_marker) == 1
