#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Provider 抽象层：定义统一的 LLM 调用接口。

业务层（评分编排器）只依赖 BaseLLMProvider 与 ProviderChatResult，
不感知具体厂商 SDK；新增模型只需新增一个适配器类并在 registry 注册。
"""

import logging
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


@dataclass
class ProviderChatResult:
    """单次对话的统一返回结果"""
    content: str
    reasoning_content: Optional[str] = None
    raw: Optional[Any] = None


class BaseLLMProvider(ABC):
    """所有 AI Provider 适配器的统一基类。"""

    def __init__(
        self,
        *,
        id: str,
        name: str,
        provider_type: str,
        model: str,
        base_url: Optional[str],
        api_key: str,
        timeout: int = 180,
        extra: Optional[Dict[str, Any]] = None,
    ):
        self.id = id
        self.name = name
        self.provider_type = provider_type
        self.model = model
        self.base_url = (base_url or "").rstrip("/")
        self.api_key = api_key
        self.timeout = timeout
        self.extra = extra or {}

    @abstractmethod
    async def chat(
        self,
        messages: List[Dict[str, str]],
        *,
        temperature: float = 0.2,
        max_tokens: int = 2048,
        timeout: Optional[float] = None,
    ) -> ProviderChatResult:
        """单次对话，返回文本内容；推理模型在此统一取 content / reasoning_content。"""

    def supports_reasoning(self) -> bool:
        caps = self.extra.get("capabilities") or {}
        return bool(caps.get("supports_reasoning", False))

    def to_public(self) -> Dict[str, Any]:
        """对外暴露信息（不含密钥）。"""
        return {
            "id": self.id,
            "name": self.name,
            "provider_type": self.provider_type,
            "base_url": self.base_url,
            "model": self.model,
            "is_default": self.extra.get("is_default", False),
            "is_enabled": self.extra.get("is_enabled", True),
            "timeout": self.timeout,
        }
