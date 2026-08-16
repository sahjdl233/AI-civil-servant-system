#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
标准答案按需生成。

- 仅在用户主动确认"是否需要查看标准答案"后调用
- Prompt 只依赖题目材料与题型，不输入学生作答，保证范文客观
- 演示模式（占位 key）返回模拟数据
"""

import logging
from typing import Optional

from app.schemas.dual_role import StandardAnswerResult
from app.services.ai_service import (
    PLACEHOLDER_KEYS,
    clean_unicode_text,
    try_parse_json_response,
)
from app.services.providers.base import BaseLLMProvider
from app.services.prompt_service_dual import build_standard_answer_prompt, split_content

logger = logging.getLogger(__name__)


async def generate_standard_answer(
    provider: BaseLLMProvider,
    content: str,
    question_type: Optional[str] = None,
) -> StandardAnswerResult:
    """生成标准答案范文与解释。"""
    question, _ = split_content(content)
    qtype = question_type or "概括题"

    if provider.api_key in PLACEHOLDER_KEYS:
        logger.info("检测到演示模式，使用模拟标准答案")
        return StandardAnswerResult(
            standard_answer="这是一篇模拟的标准答案范文：\n\n一、总论点……\n二、分论点……\n三、结论……",
            explanation="模拟解释：本题考察概括归纳能力，答题时应先总后分、覆盖材料全部要点、语言规范凝练。",
        )

    prompt = clean_unicode_text(build_standard_answer_prompt(question, qtype))
    result = await provider.chat(
        messages=[{"role": "user", "content": prompt}],
        temperature=0.2,
        max_tokens=2048,
        timeout=float(provider.timeout),
        scene="standard_answer",
    )
    content_text = result.content
    if not content_text:
        raise ValueError("标准答案生成返回空响应")
    raw = try_parse_json_response(content_text, "标准答案")
    if not raw or not isinstance(raw, dict):
        raise ValueError("标准答案输出无法解析为 JSON")
    return StandardAnswerResult.model_validate(raw)
