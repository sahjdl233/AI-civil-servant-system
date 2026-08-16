#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
多模型评分编排器。

- 校验 Provider、识别题型（默认模型执行一次）
- 并发独立评分，单模型失败/超时不阻塞其他模型
- 提供 SSE 事件流：model_start / model_result / model_error / done(汇总)
"""

import asyncio
import json
import logging
import statistics
from typing import AsyncGenerator, Dict, List, Optional, Tuple

from app.services.ai_service import (
    clean_unicode_text,
    try_parse_json_response,
    grade_essay_with_provider,
    get_question_type_from_ai,
)
from app.services import prompt_library_service
from app.services.providers import (
    BaseLLMProvider,
    ProviderRegistry,
    ProviderNotFoundError,
)

logger = logging.getLogger(__name__)

MAX_CONCURRENT = 4  # 并发上限，防止瞬时打爆厂商 API


def _provider_public(provider: BaseLLMProvider) -> dict:
    return {
        "id": provider.id,
        "name": provider.name,
        "type": provider.provider_type,
        "model": provider.model,
    }


def _normalize_result(provider: BaseLLMProvider, result) -> dict:
    score_details = []
    if result.scoreDetails:
        for d in result.scoreDetails:
            score_details.append(d.model_dump() if hasattr(d, "model_dump") else d)
    return {
        "provider": _provider_public(provider),
        "status": "success",
        "score": float(result.score),
        "feedback": result.feedback,
        "suggestions": list(result.suggestions or []),
        "scoreDetails": score_details,
    }


async def detect_question_type(content: str, question_type: Optional[str] = None) -> Tuple[str, str]:
    """识别题型；未提供时用默认模型识别（失败回退启发式）。"""
    if question_type:
        return question_type, "client"
    try:
        qtype = await get_question_type_from_ai(content)
        return qtype, "ai"
    except Exception as e:
        logger.warning("题型识别失败，回退启发式: %s", str(e)[:200])
        return "概括题", "heuristic"


def build_aggregate(results: List[dict]) -> dict:
    """汇总对比：均分/最高/最低/分差/标准差/榜单（仅统计成功项）。"""
    scores = [r["score"] for r in results if r.get("status") == "success"]
    if not scores:
        return {"hasScore": False}
    avg = round(statistics.mean(scores), 1)
    high = max(scores)
    low = min(scores)
    stddev = round(statistics.stdev(scores), 2) if len(scores) > 1 else 0.0
    rankings = sorted(
        [
            {
                "providerId": r["provider"]["id"],
                "name": r["provider"]["name"],
                "score": r["score"],
            }
            for r in results
            if r.get("status") == "success"
        ],
        key=lambda x: x["score"],
        reverse=True,
    )
    return {
        "hasScore": True,
        "avgScore": avg,
        "maxScore": high,
        "minScore": low,
        "stdDev": stddev,
        "diff": round(high - low, 1),
        "count": len(scores),
        "rankings": rankings,
    }


async def _grade_one(
    provider: BaseLLMProvider,
    content: str,
    question_type: str,
    semaphore: asyncio.Semaphore,
) -> dict:
    async with semaphore:
        result = await grade_essay_with_provider(provider, content, question_type)
        return _normalize_result(provider, result)


async def _generate_consensus(results: List[dict], aggregate: dict) -> Optional[dict]:
    """基于 Consensus Prompt 生成多模型 AI 汇总。无默认 Provider / 未发布模板时返回 None。"""
    registry = ProviderRegistry.get_instance()
    try:
        provider = await registry.get_default()
    except ProviderNotFoundError:
        return None
    rendered = prompt_library_service.render_template(
        "consensus_prompt",
        {
            "model_results": json.dumps(results, ensure_ascii=False),
            "aggregate": json.dumps(aggregate, ensure_ascii=False),
        },
    )
    if rendered is None:
        return None
    result = await provider.chat(
        messages=[{"role": "user", "content": clean_unicode_text(rendered)}],
        temperature=0.2,
        max_tokens=1024,
        timeout=float(provider.timeout),
        scene="consensus",
    )
    content = result.content
    if not content:
        raise ValueError("consensus 返回空响应")
    raw = try_parse_json_response(content, "共识汇总")
    if not raw or not isinstance(raw, dict):
        raise ValueError("consensus 输出无法解析为 JSON")
    return {
        "consensusScore": raw.get("consensus_score"),
        "agreement": raw.get("agreement", ""),
        "disagreements": raw.get("disagreements", []),
        "combinedFeedback": raw.get("combined_feedback", ""),
        "finalSuggestions": raw.get("final_suggestions", []),
    }


async def grade_multi_stream(
    content: str,
    question_type: Optional[str],
    provider_ids: List[str],
    consensus: bool = False,
) -> AsyncGenerator[dict, None]:
    """
    SSE 事件流生成器。事件类型：
      models_started / model_start / model_result / model_error / done
    """
    registry = ProviderRegistry.get_instance()

    # 1. 解析并校验 Provider
    providers: List[BaseLLMProvider] = []
    invalid_ids: List[str] = []
    for pid in provider_ids:
        try:
            providers.append(await registry.get(pid))
        except ProviderNotFoundError:
            invalid_ids.append(pid)

    if not providers:
        try:
            providers = [await registry.get_default()]
        except ProviderNotFoundError as e:
            yield {
                "type": "error",
                "message": str(e),
            }
            return

    # 2. 识别题型（一次，全模型复用）
    qtype, qsource = await detect_question_type(content, question_type)

    yield {
        "type": "models_started",
        "providerIds": [p.id for p in providers],
        "providers": [_provider_public(p) for p in providers],
        "questionType": qtype,
        "questionTypeSource": qsource,
        "invalidIds": invalid_ids,
    }

    for p in providers:
        yield {"type": "model_start", "provider": _provider_public(p), "progress": 0}

    # 3. 并发独立评分（互不影响）
    semaphore = asyncio.Semaphore(MAX_CONCURRENT)
    tasks: Dict[asyncio.Task, BaseLLMProvider] = {}
    for p in providers:
        task = asyncio.create_task(_grade_one(p, content, qtype, semaphore))
        tasks[task] = p

    results: List[dict] = []
    pending = list(tasks.keys())
    while pending:
        done, pending = await asyncio.wait(pending, return_when=asyncio.FIRST_COMPLETED)
        for t in done:
            provider = tasks[t]
            try:
                result = t.result()
                results.append(result)
                yield {"type": "model_result", **result}
            except Exception as e:
                logger.error("模型 %s 评分失败: %s", provider.name, str(e)[:300])
                results.append(
                    {
                        "provider": _provider_public(provider),
                        "status": "error",
                        "message": str(e)[:200],
                    }
                )
                yield {
                    "type": "model_error",
                    "provider": _provider_public(provider),
                    "status": "error",
                    "message": str(e)[:200],
                }

    # 4. 汇总对比
    aggregate = build_aggregate(results)
    done_event = {"type": "done", "results": results, "aggregate": aggregate}
    if consensus:
        try:
            consensus_data = await _generate_consensus(results, aggregate)
            if consensus_data is not None:
                done_event["consensus"] = consensus_data
        except Exception as e:
            logger.warning("共识汇总生成失败: %s", str(e)[:200])
    yield done_event
