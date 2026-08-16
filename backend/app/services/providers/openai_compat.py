#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
OpenAI 兼容协议适配器。

覆盖 OpenAI / DeepSeek / Qwen / 自定义网关（custom），
同时兼容主流第三方中转站。推理模型返回的 reasoning_content 也会透出。
"""

import logging
from typing import Any, Dict, List, Optional

from openai import AsyncOpenAI
from .base import BaseLLMProvider, ProviderChatResult, LLMUsage

logger = logging.getLogger(__name__)


class OpenAICompatProvider(BaseLLMProvider):
    async def _build_client(self) -> AsyncOpenAI:
        extra_headers: Dict[str, str] = dict(self.extra.get("headers") or {})
        extra_headers.setdefault("User-Agent", "Mozilla/5.0")
        return AsyncOpenAI(
            api_key=self.api_key,
            base_url=self.base_url or "https://api.openai.com/v1",
            timeout=self.timeout,
            default_headers=extra_headers,
        )

    async def chat(
        self,
        messages: List[Dict[str, str]],
        *,
        temperature: float = 0.2,
        max_tokens: int = 2048,
        timeout: Optional[float] = None,
        scene: Optional[str] = None,
    ) -> ProviderChatResult:
        client = await self._build_client()
        response = await client.chat.completions.create(
            model=self.model,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
            timeout=timeout or float(self.timeout),
        )
        message = response.choices[0].message
        content = message.content or ""
        reasoning_content = getattr(message, "reasoning_content", None)
        if not content and reasoning_content:
            logger.info("Provider %s 返回空 content，使用 reasoning_content 作为兜底", self.name)
            content = reasoning_content

        usage = None
        u = getattr(response, "usage", None)
        if u is not None:
            prompt_tokens = getattr(u, "prompt_tokens", 0) or 0
            completion_tokens = getattr(u, "completion_tokens", 0) or 0
            total_tokens = getattr(u, "total_tokens", 0) or (prompt_tokens + completion_tokens)
            usage = LLMUsage(
                prompt_tokens=int(prompt_tokens),
                completion_tokens=int(completion_tokens),
                total_tokens=int(total_tokens),
            )
        self._record_usage(response, scene, usage)
        return ProviderChatResult(
            content=content,
            reasoning_content=reasoning_content,
            raw=response,
            usage=usage,
        )
