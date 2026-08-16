#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
双角色 AI 批改编排器。

- 阅卷官与写作教练 Prompt 完全独立，并发调用
- 输出守卫层剥离越界字段（教练中的分数、阅卷官中的改写）
- 单角色失败/超时不阻塞另一个
- 演示模式（占位 key）返回模拟数据
"""

import asyncio
import json
import logging
from typing import AsyncGenerator, Dict, Optional

from app.schemas.dual_role import CoachResult, GraderResult
from app.services.ai_service import (
    PLACEHOLDER_KEYS,
    clean_ai_thinking_patterns,
    clean_unicode_text,
    try_parse_json_response,
)
from app.services.providers.base import BaseLLMProvider
from app.services.prompt_service_dual import (
    build_coach_prompt,
    build_grader_prompt,
    split_content,
)

logger = logging.getLogger(__name__)

ROLES = [
    {
        "key": "grader",
        "name": "阅卷官",
        "build": build_grader_prompt,
        "schema": GraderResult,
    },
    {
        "key": "coach",
        "name": "写作教练",
        "build": build_coach_prompt,
        "schema": CoachResult,
    },
]

DEDUCTION_PREFIXES = ["①", "②", "③", "④"]


def guard_grader(raw: dict) -> dict:
    """阅卷官输出中不允许出现改写建议痕迹。"""
    drop_keys = [k for k in raw if k in {"rewrites", "optimized", "suggestions"}]
    return {k: v for k, v in raw.items() if k not in drop_keys}


def guard_coach(raw: dict) -> dict:
    """教练输出中不允许出现任何分数。"""
    for key in ("total_score", "score", "scoring_basis"):
        raw.pop(key, None)
    for pa in raw.get("paragraph_advice", []):
        if isinstance(pa, dict):
            pa.pop("total_score", None)
            pa.pop("score", None)
    return raw


def _clean_text(value) -> str:
    if not isinstance(value, str):
        return ""
    return clean_ai_thinking_patterns(clean_unicode_text(value))


async def _run_role(provider: BaseLLMProvider, role: dict, question: str, answer: str, qtype: str):
    prompt = clean_unicode_text(role["build"](question, answer, qtype))
    result = await provider.chat(
        messages=[{"role": "user", "content": prompt}],
        temperature=0.2,
        max_tokens=2048,
        timeout=float(provider.timeout),
        scene=role["key"],
    )
    content = result.content
    if not content:
        raise ValueError(f"{role['name']} 返回空响应")
    raw = try_parse_json_response(content, role["name"])
    if not raw or not isinstance(raw, dict):
        raise ValueError(f"{role['name']} 输出无法解析为 JSON")
    guard = guard_grader if role["key"] == "grader" else guard_coach
    return role["schema"].model_validate(guard(raw))


def _demo_grader() -> dict:
    return {
        "total_score": 72.0,
        "score_breakdown": [
            {"item": "内容要点", "full_score": 40, "actual_score": 28},
            {"item": "逻辑结构", "full_score": 30, "actual_score": 24},
            {"item": "语言表达", "full_score": 30, "actual_score": 20},
        ],
        "main_deductions": [
            {"reason": "概括要点遗漏，未覆盖材料中的部分关键信息", "deducted": 3},
            {"reason": "逻辑层次不够清晰，段落间衔接生硬", "deducted": 2},
            {"reason": "语言表达口语化，不够规范凝练", "deducted": 3},
        ],
        "scoring_basis": "依据概括题评分标准，从内容要点、逻辑结构、语言表达三个维度综合评定。",
    }


def _demo_coach() -> dict:
    return {
        "paragraph_advice": [
            {
                "paragraph": "第一段",
                "diagnosis": "开头引入较平，未能快速点明核心观点",
                "suggestions": ["将总论点前置，明确回答题目要求"],
                "rewrites": [
                    {
                        "original": "随着社会发展，……这一问题日益突出。",
                        "optimized": "在……背景下，……的问题不容忽视，亟需引起重视。",
                        "why": "将背景与问题直接关联，观点更鲜明",
                    }
                ],
            },
            {
                "paragraph": "第三段",
                "diagnosis": "论据与论点关联不够紧密",
                "suggestions": ["补充材料中的具体案例作为支撑"],
                "rewrites": [],
            },
        ],
        "overall_advice": "整体建议：加强论点前置与论据支撑，精简口语化表达。",
    }


def build_combined(grader: Optional[dict], coach: Optional[dict]) -> dict:
    part1 = None
    if grader:
        deductions = []
        for i, d in enumerate(grader.get("main_deductions") or []):
            if i >= len(DEDUCTION_PREFIXES):
                break
            prefix = DEDUCTION_PREFIXES[i]
            reason = _clean_text(d.get("reason"))
            if not reason:
                continue
            deductions.append(f"{prefix} {reason}")
        part1 = {
            "score": round(float(grader.get("total_score", 0))),
            "mainDeductions": deductions,
            "scoringBasis": _clean_text(grader.get("scoring_basis")),
        }
    part2 = None
    if coach:
        paragraph_advice = []
        for pa in coach.get("paragraph_advice") or []:
            paragraph_advice.append(
                {
                    "paragraph": _clean_text(pa.get("paragraph")),
                    "diagnosis": _clean_text(pa.get("diagnosis")),
                    "suggestions": [_clean_text(s) for s in (pa.get("suggestions") or [])],
                    "rewrites": [
                        {
                            "original": _clean_text(r.get("original")),
                            "optimized": _clean_text(r.get("optimized")),
                            "why": _clean_text(r.get("why")),
                        }
                        for r in (pa.get("rewrites") or [])
                    ],
                }
            )
        part2 = {
            "paragraphAdvice": paragraph_advice,
            "overallAdvice": _clean_text(coach.get("overall_advice")),
        }
    return {"part1": part1, "part2": part2}


async def grade_dual_stream(
    provider: BaseLLMProvider,
    content: str,
    question_type: Optional[str] = None,
) -> AsyncGenerator[dict, None]:
    """双角色批改 SSE 事件流生成器。"""
    question, answer = split_content(content)
    qtype = question_type or "概括题"

    yield {
        "type": "roles_started",
        "roles": [{"key": r["key"], "name": r["name"]} for r in ROLES],
    }

    for role in ROLES:
        yield {"type": "role_start", "role": role["key"]}

    results: Dict[str, Optional[dict]] = {"grader": None, "coach": None}

    if provider.api_key in PLACEHOLDER_KEYS:
        logger.info("检测到演示模式，使用模拟双角色数据")
        demo = {"grader": _demo_grader(), "coach": _demo_coach()}
        for role in ROLES:
            data = demo[role["key"]]
            results[role["key"]] = data
            yield {"type": "role_result", "role": role["key"], "data": data}
    else:
        tasks = {}
        for role in ROLES:
            task = asyncio.create_task(_run_role(provider, role, question, answer, qtype))
            tasks[task] = role

        pending = set(tasks.keys())
        while pending:
            done, pending = await asyncio.wait(pending, return_when=asyncio.FIRST_COMPLETED)
            for t in done:
                role = tasks[t]
                try:
                    data = t.result().model_dump()
                    results[role["key"]] = data
                    yield {"type": "role_result", "role": role["key"], "data": data}
                except Exception as e:
                    logger.error("角色 %s 失败: %s", role["name"], str(e)[:300])
                    results[role["key"]] = None
                    yield {"type": "role_error", "role": role["key"], "message": str(e)[:200]}

    combined = build_combined(results["grader"], results["coach"])
    yield {
        "type": "done",
        "grader": results["grader"],
        "coach": results["coach"],
        "combined": combined,
    }
