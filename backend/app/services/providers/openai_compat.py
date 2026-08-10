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
from .base import BaseLLMProvider, ProviderChatResult

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
        return ProviderChatResult(
            content=content,
            reasoning_content=reasoning_content,
            raw=response,
        )
