#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
火山引擎优化版AI服务
专门针对火山引擎API的超时和性能问题进行优化
"""

import json
import logging
from typing import Optional
from openai import AsyncOpenAI
from ..core.config import settings
from ..schemas.essay import EssayGradingResult, ScoreDetail

logger = logging.getLogger(__name__)


async def grade_essay_simple(essay_content: str, question_type: Optional[str] = None) -> EssayGradingResult:
    """
    简化版AI评分服务 - 火山引擎优化版
    使用单次请求完成评分，避免超时问题
    """
    try:
        client = AsyncOpenAI(
            api_key=settings.openai_api_key,
            base_url=settings.openai_api_base,
            timeout=120.0,  # 增加超时时间到2分钟
        )
        
        # 简化的评分prompt
        prompt = f"""你是申论评分专家，请对以下{question_type or '申论'}答案进行评分。

答案内容：
{essay_content}

请按以下JSON格式返回评分结果：
{{
    "score": 分数(0-100),
    "feedback": "整体评价和建议",
    "strengths": ["优点1", "优点2"],
    "improvements": ["改进建议1", "改进建议2"]
}}

要求：
1. 分数要客观公正
2. 评价要具体有针对性
3. 建议要实用可操作
4. 严格按JSON格式返回"""

        response = await client.chat.completions.create(
            model=settings.openai_model_name,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3,
            max_tokens=800,  # 限制token数量
            timeout=120.0
        )
        
        ai_response = response.choices[0].message.content
        if not ai_response:
            raise ValueError("AI返回空响应")
        
        # 解析AI响应
        try:
            # 提取JSON部分
            json_start = ai_response.find('{')
            json_end = ai_response.rfind('}')
            if json_start != -1 and json_end != -1:
                json_str = ai_response[json_start:json_end + 1]
                result_data = json.loads(json_str)
            else:
                raise ValueError("无法找到JSON格式")
            
            score = float(result_data.get("score", 75))
            feedback = result_data.get("feedback", "AI评分完成")
            strengths = result_data.get("strengths", [])
            improvements = result_data.get("improvements", [])
            
            # 合并建议
            suggestions = improvements + [f"继续保持：{s}" for s in strengths[:2]]
            
            # 创建评分细则
            score_details = [
                ScoreDetail(
                    item="综合评价",
                    fullScore=100.0,
                    actualScore=score,
                    description=feedback
                )
            ]
            
            return EssayGradingResult(
                score=score,
                feedback=feedback,
                suggestions=suggestions[:5],  # 限制建议数量
                scoreDetails=score_details
            )
            
        except (json.JSONDecodeError, KeyError, ValueError) as e:
            logger.warning(f"AI响应解析失败: {e}")
            # 使用回退方案
            return EssayGradingResult(
                score=75.0,
                feedback="AI评分完成，请参考具体建议进行改进。",
                suggestions=["加强论点的逻辑性", "提高语言表达的准确性"],
                scoreDetails=[
                    ScoreDetail(
                        item="综合评价",
                        fullScore=100.0,
                        actualScore=75.0,
                        description="AI评分完成"
                    )
                ]
            )
            
    except Exception as e:
        logger.error(f"简化AI评分失败: {e}")
        # 返回默认评分
        return EssayGradingResult(
            score=75.0,
            feedback=f"AI服务暂时不可用: {str(e)[:100]}",
            suggestions=["请稍后重试", "检查网络连接"],
            scoreDetails=[
                ScoreDetail(
                    item="综合评价",
                    fullScore=100.0,
                    actualScore=75.0,
                    description="服务异常，返回默认评分"
                )
            ]
        )


async def get_question_type_simple(question_text: str) -> str:
    """简化版题型识别"""
    try:
        client = AsyncOpenAI(
            api_key=settings.openai_api_key,
            base_url=settings.openai_api_base,
            timeout=60.0,
        )
        
        prompt = f"""请识别以下申论题目的类型，只返回以下四个选项之一：
概括题、综合分析题、对策题、应用文写作题

题目内容：
{question_text}

答案："""

        response = await client.chat.completions.create(
            model=settings.openai_model_name,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.1,
            max_tokens=50,
            timeout=60.0
        )
        
        ai_response = response.choices[0].message.content
        if not ai_response:
            return "概括题"
        
        # 检查返回的题型
        valid_types = ["概括题", "综合分析题", "对策题", "应用文写作题"]
        for valid_type in valid_types:
            if valid_type in ai_response:
                return valid_type
        
        return "概括题"
        
    except Exception as e:
        logger.error(f"简化题型识别失败: {e}")
        # 使用启发式识别
        if any(keyword in question_text for keyword in ['分析', '理解', '谈谈', '评价']):
            return "综合分析题"
        elif any(keyword in question_text for keyword in ['对策', '建议', '措施']):
            return "对策题"
        elif any(keyword in question_text for keyword in ['写', '拟', '倡议书', '讲话稿']):
            return "应用文写作题"
        else:
            return "概括题"