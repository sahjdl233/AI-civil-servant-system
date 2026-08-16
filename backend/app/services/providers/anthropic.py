#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Anthropic (Claude) 原生适配器。

通过 httpx 调用 Anthropic Messages API，不依赖额外 SDK。
"""

import logging
from typing import Dict, List, Optional

import httpx

from .base import BaseLLMProvider, ProviderChatResult, LLMUsage

logger = logging.getLogger(__name__)


class AnthropicProvider(BaseLLMProvider):
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        # Anthropic 默认端点；若 base_url 已配置 /v1，不再重复拼接
        if not self.base_url:
            self.base_url = "https://api.anthropic.com"

    async def chat(
        self,
        messages: List[Dict[str, str]],
        *,
        temperature: float = 0.2,
        max_tokens: int = 2048,
        timeout: Optional[float] = None,
        scene: Optional[str] = None,
    ) -> ProviderChatResult:
        version = self.extra.get("anthropic_version") or "2023-06-01"
        # 系统消息与用户消息分离
        system_parts = [m["content"] for m in messages if m.get("role") == "system"]
        api_messages = [
            {"role": m["role"], "content": m["content"]}
            for m in messages
            if m.get("role") in ("user", "assistant")
        ]

        payload: Dict[str, object] = {
            "model": self.model,
            "max_tokens": max_tokens,
            "temperature": temperature,
            "messages": api_messages,
        }
        if system_parts:
            payload["system"] = "\n\n".join(system_parts)

        headers = {
            "x-api-key": self.api_key,
            "anthropic-version": version,
            "content-type": "application/json",
        }

        url = f"{self.base_url}/v1/messages"
        timeout_sec = timeout or float(self.timeout)
        async with httpx.AsyncClient(timeout=timeout_sec) as client:
            resp = await client.post(url, json=payload, headers=headers)
            if resp.status_code >= 400:
                detail = resp.text[:300]
                logger.error("Claude API 错误 %s: %s", resp.status_code, detail)
                raise RuntimeError(f"Claude API {resp.status_code}: {detail}")
            data = resp.json()

        text = "".join(
            block.get("text", "")
            for block in data.get("content", [])
            if block.get("type") == "text"
        )

        usage = None
        u = data.get("usage") or {}
        if u:
            input_tokens = int(u.get("input_tokens") or 0)
            output_tokens = int(u.get("output_tokens") or 0)
            usage = LLMUsage(
                prompt_tokens=input_tokens,
                completion_tokens=output_tokens,
                total_tokens=input_tokens + output_tokens,
            )
        self._record_usage(data, scene, usage)
        return ProviderChatResult(content=text or "", raw=data, usage=usage)
