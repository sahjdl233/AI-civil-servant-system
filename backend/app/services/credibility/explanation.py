#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
评分可信度说明生成器（规则生成，纯函数可单测）。

- level / explanation：基于星级与统计指标生成可读文案
- riskNote：命中「Prompt 不稳定」等风险提示
"""

import logging
from typing import Optional

logger = logging.getLogger(__name__)

# 星级文案模板（{scores} 占位）
EXPLANATION_TEMPLATES = {
    5: "三次评分高度一致（{scores} 分），评分稳定，可信度高。",
    4: "三次评分较为接近（{scores} 分），评分基本稳定，可信度良好。",
    3: "三次评分存在一定波动（{scores} 分），建议结合多模型阅卷综合判断。",
    2: "三次评分波动明显（{scores} 分），当前 Prompt 的评分不稳定，建议调整 Prompt 或更换模型后重新评分。",
    1: "三次评分严重不一致（{scores} 分），当前评分不可信，请调整 Prompt / 模型后重试。",
}

UNAVAILABLE_EXPLANATION = "有效评分不足，无法评估可信度。"
UNAVAILABLE_NO_SCORE = "无评分结果，无法评估可信度。"

# riskNote 触发阈值
PROMPT_UNSTABLE_MAX_STARS = 3
PROMPT_UNSTABLE_MIN_STDDEV = 3.0


def _format_scores(scores) -> str:
    """把 [81, 80, 82] 格式化为 "81/80/82"。"""
    return "/".join(str(int(s)) if float(s).is_integer() else str(s) for s in scores)


def generate_explanation(
    computed: dict,
    *,
    stddev_min: float = PROMPT_UNSTABLE_MIN_STDDEV,
) -> dict:
    """基于 compute_credibility 的结果生成说明。

    返回 { explanation, riskNote }。
    """
    if not computed.get("hasScore"):
        scores = computed.get("scores") or []
        explanation = (
            UNAVAILABLE_EXPLANATION if scores else UNAVAILABLE_NO_SCORE
        )
        return {
            "explanation": explanation,
            "riskNote": "",
        }

    scores = computed.get("scores") or []
    stars = computed.get("stars", 1)
    stddev = (computed.get("statistics") or {}).get("stdDev", 0.0)

    scores_text = _format_scores(scores)
    explanation = EXPLANATION_TEMPLATES.get(
        stars, EXPLANATION_TEMPLATES[1]
    ).format(scores=scores_text)

    risk_note = ""
    if stars <= PROMPT_UNSTABLE_MAX_STARS and stddev >= stddev_min:
        risk_note = "Prompt 不稳定"
    if stars == 1:
        risk_note = "Prompt 不稳定" if risk_note else "建议降低评分 Prompt 的模糊性，或改用多模型交叉阅卷"

    return {
        "explanation": explanation,
        "riskNote": risk_note,
    }
