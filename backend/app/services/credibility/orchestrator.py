#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
评分可信度编排器。

- 解析 Provider（未指定用默认）
- 识别题型一次，全轮复用
- 按配置并发执行 N 次同一评分链路（grade_essay_with_provider）
- 用成功轮次计算可信度并生成说明
- SSE 事件流：runs_started / run_result / run_error / done(可信度结论)
"""

import asyncio
import logging
from typing import AsyncGenerator, List, Optional

from app.core.config import settings
from app.services.ai_service import grade_essay_with_provider
from app.services.credibility.compute import compute_credibility
from app.services.credibility.explanation import generate_explanation
from app.services.grading.orchestrator import detect_question_type
from app.services.providers import (
    BaseLLMProvider,
    ProviderRegistry,
    ProviderNotFoundError,
)

logger = logging.getLogger(__name__)


def _provider_public(provider: BaseLLMProvider) -> dict:
    return {
        "id": provider.id,
        "name": provider.name,
        "type": provider.provider_type,
        "model": provider.model,
    }


async def _grade_one(
    provider: BaseLLMProvider,
    content: str,
    question_type: str,
) -> float:
    """执行一次评分，返回分数。失败时抛异常由调用方处理。"""
    result = await grade_essay_with_provider(provider, content, question_type)
    return float(result.score)


async def grade_credibility_stream(
    content: str,
    question_type: Optional[str],
    provider_id: Optional[str],
    rounds: Optional[int],
) -> AsyncGenerator[dict, None]:
    """
    SSE 事件流生成器。事件类型：
      runs_started / run_result / run_error / done / error
    """
    registry = ProviderRegistry.get_instance()

    # 1. 解析 Provider
    provider: Optional[BaseLLMProvider] = None
    if provider_id:
        try:
            provider = await registry.get(provider_id)
        except ProviderNotFoundError as e:
            yield {"type": "error", "message": str(e)}
            return
    else:
        try:
            provider = await registry.get_default()
        except ProviderNotFoundError as e:
            yield {"type": "error", "message": str(e)}
            return

    rounds = rounds or settings.CREDIBILITY_ROUNDS
    rounds = max(2, min(5, int(rounds)))

    # 2. 识别题型（一次，全轮复用）
    qtype, qsource = await detect_question_type(content, question_type)

    yield {
        "type": "runs_started",
        "rounds": rounds,
        "provider": _provider_public(provider),
        "questionType": qtype,
        "questionTypeSource": qsource,
    }

    # 3. 并发/串行执行 N 次评分（默认串行，贴合「连续评分三次」）
    concurrency = max(1, settings.CREDIBILITY_CONCURRENCY)
    semaphore = asyncio.Semaphore(concurrency)

    async def _guarded(index: int) -> dict:
        async with semaphore:
            try:
                score = await _grade_one(provider, content, qtype)
                return {"index": index, "status": "success", "score": score}
            except Exception as e:
                logger.error("可信度第 %s 轮评分失败: %s", index + 1, str(e)[:300])
                return {
                    "index": index,
                    "status": "error",
                    "message": str(e)[:200],
                }

    tasks = [asyncio.create_task(_guarded(i)) for i in range(rounds)]
    results: List[dict] = []
    pending = list(tasks)
    while pending:
        done, pending = await asyncio.wait(pending, return_when=asyncio.FIRST_COMPLETED)
        for t in done:
            res = t.result()
            results.append(res)
            if res["status"] == "success":
                yield {
                    "type": "run_result",
                    "index": res["index"],
                    "score": res["score"],
                    "status": "success",
                    "provider": _provider_public(provider),
                }
            else:
                yield {
                    "type": "run_error",
                    "index": res["index"],
                    "status": "error",
                    "message": res["message"],
                    "provider": _provider_public(provider),
                }

    # 4. 可信度计算 + 说明
    results.sort(key=lambda r: r["index"])
    scores = [r["score"] for r in results if r["status"] == "success"]
    failed_rounds = [
        {"index": r["index"], "message": r.get("message", "")}
        for r in results
        if r["status"] != "success"
    ]

    computed = compute_credibility(
        scores,
        range_penalty=settings.CREDIBILITY_RANGE_PENALTY,
        star_thresholds=settings.CREDIBILITY_STAR_THRESHOLDS,
    )
    explanation = generate_explanation(computed)

    done_event = {
        "type": "done",
        "rounds": rounds,
        "scores": computed.get("scores", []),
        "statistics": computed.get("statistics"),
        "credibilityScore": computed.get("credibilityScore"),
        "stars": computed.get("stars", 0),
        "level": computed.get("level", "无法评估"),
        "explanation": explanation["explanation"],
        "riskNote": explanation["riskNote"],
        "failedRounds": failed_rounds,
        "hasScore": computed.get("hasScore", False),
    }
    yield done_event
