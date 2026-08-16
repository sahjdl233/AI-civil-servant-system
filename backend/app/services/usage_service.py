#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Token 用量记录与统计服务。

- 记录：schedule_record() 异步写库，失败仅记日志，绝不影响评分主链路。
- 统计：get_stats() 按 Provider / 模型 / 场景聚合某时间窗内的 Token 消耗。
"""

import asyncio
import logging
import uuid
from datetime import datetime, time, timedelta
from typing import List, Optional

from sqlalchemy import func

from app.db.database import SessionLocal
from app.models.usage import TokenUsage
from app.services.providers.base import LLMUsage

logger = logging.getLogger(__name__)

RANGE_ALIASES = ["today", "yesterday", "7d", "30d", "all"]


def _now() -> datetime:
    return datetime.utcnow()


def _range_bounds(range_key: str):
    """返回 (start, end) 时间窗；start/end 为 None 表示不过滤。"""
    now = _now()
    start = end = None
    if range_key == "today":
        start = datetime.combine(now.date(), time.min)
        end = datetime.combine(now.date(), time.max)
    elif range_key == "yesterday":
        d = now.date() - timedelta(days=1)
        start = datetime.combine(d, time.min)
        end = datetime.combine(d, time.max)
    elif range_key == "7d":
        start = datetime.combine(now.date(), time.min) - timedelta(days=6)
        end = datetime.combine(now.date(), time.max)
    elif range_key == "30d":
        start = datetime.combine(now.date(), time.min) - timedelta(days=29)
        end = datetime.combine(now.date(), time.max)
    return start, end


def schedule_record(
    *,
    provider_id: str,
    provider_name: str,
    provider_type: Optional[str],
    model: Optional[str],
    scene: Optional[str],
    usage: LLMUsage,
) -> None:
    """异步落库一条 Token 用量；无事件循环时降级为同步写。"""
    async def _do() -> None:
        try:
            with SessionLocal() as db:
                db.add(
                    TokenUsage(
                        id=str(uuid.uuid4()),
                        provider_id=provider_id,
                        provider_name=provider_name,
                        provider_type=provider_type,
                        model=model,
                        scene=scene or "unknown",
                        prompt_tokens=int(usage.prompt_tokens or 0),
                        completion_tokens=int(usage.completion_tokens or 0),
                        total_tokens=int(usage.total_tokens or 0),
                    )
                )
                db.commit()
        except Exception:
            logger.exception("Token 用量记录失败: provider=%s", provider_name)

    try:
        asyncio.create_task(_do())
    except RuntimeError:
        logger.warning("无事件循环，Token 用量记录跳过: provider=%s", provider_name)


def _cost_of(item: dict) -> Optional[float]:
    """根据 Provider 单价估算成本（元）。未配置单价返回 None。"""
    input_price = item.get("cost_per_1k_input")
    output_price = item.get("cost_per_1k_output")
    if not input_price and not output_price:
        return None
    input_price = float(input_price or 0)
    output_price = float(output_price or 0)
    return round(
        item.get("promptTokens", 0) / 1000 * input_price
        + item.get("completionTokens", 0) / 1000 * output_price,
        4,
    )


def get_stats(
    range_key: str = "today",
    group_by: str = "provider",
    exclude_test: bool = True,
) -> dict:
    """聚合 Token 消耗统计。

    group_by: provider（默认，按 Provider 聚合）/ model / scene
    """
    if range_key not in RANGE_ALIASES:
        range_key = "today"
    if group_by not in ("provider", "model", "scene"):
        group_by = "provider"

    start, end = _range_bounds(range_key)

    filters = []
    if start is not None:
        filters.append(TokenUsage.created_at >= start)
    if end is not None:
        filters.append(TokenUsage.created_at <= end)
    if exclude_test:
        filters.append(TokenUsage.scene != "test")

    group_cols = {
        "provider": [
            TokenUsage.provider_id,
            TokenUsage.provider_name,
            TokenUsage.provider_type,
        ],
        "model": [
            TokenUsage.provider_name,
            TokenUsage.model,
            TokenUsage.provider_type,
        ],
        "scene": [TokenUsage.scene],
    }[group_by]

    with SessionLocal() as db:
        rows = (
            db.query(
                *group_cols,
                func.count(TokenUsage.id),
                func.sum(TokenUsage.prompt_tokens),
                func.sum(TokenUsage.completion_tokens),
                func.sum(TokenUsage.total_tokens),
            )
            .filter(*filters)
            .group_by(*group_cols)
            .order_by(func.sum(TokenUsage.total_tokens).desc())
            .all()
        )

        # 各 Provider 的成本单价（来自 AiProvider.extra）
        prices = _load_prices(db)

        items: List[dict] = []
        for row in rows:
            base = {g.key: row[i] for i, g in enumerate(group_cols)}
            item = {
                "providerId": base.get("provider_id"),
                "providerName": base.get("provider_name") or base.get("model") or base.get("scene"),
                "providerType": base.get("provider_type"),
                "model": base.get("model"),
                "scene": base.get("scene"),
                "callCount": int(row[len(group_cols)]),
                "promptTokens": int(row[len(group_cols) + 1] or 0),
                "completionTokens": int(row[len(group_cols) + 2] or 0),
                "totalTokens": int(row[len(group_cols) + 3] or 0),
            }
            item["estimatedCost"] = _cost_of({**item, **prices.get(item.get("providerName"), {})})
            items.append(item)

        summary = {
            "callCount": sum(i["callCount"] for i in items),
            "promptTokens": sum(i["promptTokens"] for i in items),
            "completionTokens": sum(i["completionTokens"] for i in items),
            "totalTokens": sum(i["totalTokens"] for i in items),
        }

    return {
        "range": range_key,
        "start": start.isoformat() if start else None,
        "end": end.isoformat() if end else None,
        "groupBy": group_by,
        "summary": summary,
        "items": items,
    }


def _load_prices(db) -> dict:
    """从 ai_providers.extra 读取单价配置，返回 {provider_name: {cost_per_1k_input, cost_per_1k_output}}。"""
    from app.models.provider import AiProvider

    prices: dict = {}
    try:
        for row in db.query(AiProvider).all():
            extra = row.extra or {}
            p = {}
            if extra.get("cost_per_1k_input") is not None:
                p["cost_per_1k_input"] = extra.get("cost_per_1k_input")
            if extra.get("cost_per_1k_output") is not None:
                p["cost_per_1k_output"] = extra.get("cost_per_1k_output")
            if p:
                prices[row.name] = p
    except Exception:
        logger.exception("读取 Provider 单价配置失败")
    return prices
