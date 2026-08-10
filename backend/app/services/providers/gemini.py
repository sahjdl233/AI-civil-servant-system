#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Google Gemini 原生适配器。

通过 httpx 调用 Gemini generateContent REST API，不依赖额外 SDK。
"""

import logging
from typing import Dict, List, Optional

import httpx

from .base import BaseLLMProvider, ProviderChatResult

logger = logging.getLogger(__name__)


class GeminiProvider(BaseLLMProvider):
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        if not self.base_url:
            self.base_url = "https://generativelanguage.googleapis.com"

    async def chat(
        self,
        messages: List[Dict[str, str]],
        *,
        temperature: float = 0.2,
        max_tokens: int = 2048,
        timeout: Optional[float] = None,
    ) -> ProviderChatResult:
        # 转换 OpenAI 风格 messages -> Gemini contents
        contents = []
        for m in messages:
            role = m.get("role", "user")
            gemini_role = "model" if role == "assistant" else "user"
            contents.append({"role": gemini_role, "parts": [{"text": m.get("content", "")}]})

        payload: Dict[str, object] = {
            "contents": contents,
            "generationConfig": {
                "temperature": temperature,
                "maxOutputTokens": max_tokens,
            },
        }

        # model 名可能带 "models/xxx" 或 "xxx"
        model_ref = self.model if self.model.startswith("models/") else f"models/{self.model}"
        url = f"{self.base_url}/v1beta/{model_ref}:generateContent"
        headers = {
            "content-type": "application/json",
            "x-goog-api-key": self.api_key,
        }
        timeout_sec = timeout or float(self.timeout)
        async with httpx.AsyncClient(timeout=timeout_sec) as client:
            resp = await client.post(url, json=payload, headers=headers)
            if resp.status_code >= 400:
                detail = resp.text[:300]
                logger.error("Gemini API 错误 %s: %s", resp.status_code, detail)
                raise RuntimeError(f"Gemini API {resp.status_code}: {detail}")
            data = resp.json()

        text = ""
        for candidate in data.get("candidates", []) or []:
            for part in (candidate.get("content") or {}).get("parts", []) or []:
                text += part.get("text", "")
        return ProviderChatResult(content=text or "", raw=data)
