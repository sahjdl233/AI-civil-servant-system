#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
ProviderRegistry：从数据库加载 Provider 配置，构建适配器实例并提供缓存。

- 进程内缓存 + asyncio.Lock 防并发重建
- CRUD 变更后调用 invalidate() 清空缓存
- 未配置任何 Provider 时，从环境变量种子兜底
"""

import asyncio
import logging
from typing import List, Optional

from app.core.config import settings
from app.models.provider import AiProvider
from app.db.database import SessionLocal
from .base import BaseLLMProvider
from .openai_compat import OpenAICompatProvider
from .anthropic import AnthropicProvider
from .gemini import GeminiProvider

logger = logging.getLogger(__name__)

# provider_type -> 适配器类（新增模型在此注册）
ADAPTERS = {
    "openai": OpenAICompatProvider,
    "deepseek": OpenAICompatProvider,
    "qwen": OpenAICompatProvider,
    "custom": OpenAICompatProvider,
    "claude": AnthropicProvider,
    "gemini": GeminiProvider,
}


class ProviderNotFoundError(KeyError):
    pass


class ProviderRegistry:
    _instance: Optional["ProviderRegistry"] = None

    def __init__(self):
        self._cache: Optional[List[BaseLLMProvider]] = None
        self._lock = asyncio.Lock()

    @classmethod
    def get_instance(cls) -> "ProviderRegistry":
        if cls._instance is None:
            cls._instance = ProviderRegistry()
        return cls._instance

    # ---------- 加载与缓存 ----------

    def _row_to_provider(self, row: AiProvider) -> BaseLLMProvider:
        adapter_cls = ADAPTERS.get(row.provider_type)
        if adapter_cls is None:
            logger.warning("未知 provider_type=%s，回退到 OpenAI 兼容适配器", row.provider_type)
            adapter_cls = OpenAICompatProvider
        extra = dict(row.extra or {})
        extra.setdefault("is_default", bool(row.is_default))
        extra.setdefault("is_enabled", bool(row.is_enabled))
        return adapter_cls(
            id=row.id,
            name=row.name,
            provider_type=row.provider_type,
            model=row.model,
            base_url=row.base_url,
            api_key=row.api_key,
            timeout=row.timeout,
            extra=extra,
        )

    async def load_all(self) -> List[BaseLLMProvider]:
        """从数据库加载全部 Provider（含禁用），若库为空则用环境变量种子。"""
        if self._cache is not None:
            return self._cache

        async with self._lock:
            if self._cache is not None:
                return self._cache

            providers: List[BaseLLMProvider] = []
            with SessionLocal() as db:
                rows = db.query(AiProvider).order_by(AiProvider.created_at.asc()).all()
                providers = [self._row_to_provider(r) for r in rows]

            if not providers:
                seed = self._build_seed_from_env()
                if seed:
                    providers = [seed]
                    logger.info("Provider 表为空，使用环境变量种子 Provider: %s", seed.name)

            self._cache = providers
            return providers

    def _build_seed_from_env(self) -> Optional[BaseLLMProvider]:
        """从 config 环境变量构建默认 Provider（老配置无缝升级）。"""
        key = settings.openai_api_key
        if not key or key in ["sk-test-key-placeholder", "你的OpenAI密钥", "your-openai-api-key", "sk-your-openai-api-key-here"]:
            return None
        base = settings.openai_api_base or ""
        provider_type = "deepseek" if "deepseek" in base else ("custom" if "kkyyxx" in base else "openai")
        return OpenAICompatProvider(
            id="seed-default",
            name=settings.openai_model_name or "默认模型",
            provider_type=provider_type,
            model=settings.openai_model_name or "gpt-4o-mini",
            base_url=base,
            api_key=key,
            timeout=180,
            extra={"is_default": True, "is_enabled": True, "from_env": True},
        )

    async def invalidate(self) -> None:
        self._cache = None

    # ---------- 查询接口 ----------

    async def list_enabled(self) -> List[BaseLLMProvider]:
        all_providers = await self.load_all()
        enabled = [p for p in all_providers if p.extra.get("is_enabled", True)]
        return enabled

    async def get(self, provider_id: str) -> BaseLLMProvider:
        all_providers = await self.load_all()
        for p in all_providers:
            if p.id == provider_id:
                return p
        raise ProviderNotFoundError(f"Provider 不存在: {provider_id}")

    async def get_default(self) -> BaseLLMProvider:
        all_providers = await self.load_all()
        for p in all_providers:
            if p.extra.get("is_default"):
                return p
        if all_providers:
            return all_providers[0]
        raise ProviderNotFoundError("未配置任何 AI Provider")
