#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
评分可信度计算（纯函数，可单测）。

- 输入：rounds 个成功评分的分数列表（取值域 0~100）
- 输出：统计指标 + credibilityScore(0~100) + stars(1~5) + level

映射规则（阈值可配置）：
    credibilityScore = max(0, 100 - RANGE_PENALTY * range)
    stars 由 STAR_THRESHOLDS 二分查找得到。
"""

import logging
import statistics
from typing import List, Optional

logger = logging.getLogger(__name__)

# 默认阈值（可通过 settings 覆盖，见 build_mapping）
DEFAULT_RANGE_PENALTY = 5.0
DEFAULT_STAR_THRESHOLDS = [85, 70, 55, 35]

# 星级等级文案（索引 = stars - 1）
STAR_LEVELS = {
    5: "高度可信",
    4: "较为可信",
    3: "一般可信",
    2: "可信度较低",
    1: "不可信",
}

# 无法评估的返回结构
def _unavailable(reason: str) -> dict:
    return {
        "hasScore": False,
        "reason": reason,
        "scores": [],
        "statistics": None,
        "credibilityScore": None,
        "stars": 0,
        "level": "无法评估",
    }


def compute_credibility(
    scores: List[float],
    *,
    range_penalty: float = DEFAULT_RANGE_PENALTY,
    star_thresholds: Optional[List[float]] = None,
) -> dict:
    """输入分数列表，输出统计指标 + credibilityScore + stars + level。

    - scores 为空或不足 2 个时返回 hasScore=False（无法评估）。
    - 极差越大可信度分越低；分差相同但分数更低时标准差异不参与扣分。
    """
    thresholds = sorted(
        (star_thresholds or DEFAULT_STAR_THRESHOLDS), reverse=True
    )
    if not thresholds:
        thresholds = sorted(DEFAULT_STAR_THRESHOLDS, reverse=True)

    scores = [float(s) for s in scores if s is not None]
    if len(scores) < 2:
        reason = "有效评分不足" if scores else "无评分结果"
        return _unavailable(reason)

    mean = round(statistics.mean(scores), 1)
    low = min(scores)
    high = max(scores)
    rng = round(high - low, 1)
    stddev = round(statistics.pstdev(scores), 2) if len(scores) > 1 else 0.0

    credibility = max(0.0, 100.0 - range_penalty * rng)
    stars = _stars_from_score(credibility, thresholds)

    return {
        "hasScore": True,
        "scores": scores,
        "statistics": {
            "mean": mean,
            "min": low,
            "max": high,
            "range": rng,
            "stdDev": stddev,
        },
        "credibilityScore": round(credibility, 1),
        "stars": stars,
        "level": STAR_LEVELS.get(stars, "不可信"),
    }


def _stars_from_score(credibility: float, thresholds: List[float]) -> int:
    """按 [>=t1 => 5, >=t2 => 4, ...] 映射星级；默认 1 星。

    N 个阈值产生 N+1 个星级档位（5 档），对应 ★★★★★ ~ ★☆☆☆☆。
    """
    descending = sorted(thresholds, reverse=True)
    for i, t in enumerate(descending):
        if credibility >= t:
            return len(descending) + 1 - i
    return 1
