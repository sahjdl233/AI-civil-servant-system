#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
双角色批改独立 Prompt 构建器。

阅卷官、写作教练、标准答案三个 Prompt 完全独立：
- 均由同一份原始输入（题目材料 + 作答 + 题型）独立构建
- 互相不引用对方的输出
- 各自的"硬性禁止"段限定职责边界
"""

QUESTION_MARKERS = ["【题目材料与题干】", "【题目材料及问题】", "【题目材料】", "【题干】"]
ANSWER_MARKERS = ["【我的作答】", "【我的答案】", "【学生作答】"]


def split_content(content: str):
    """从提交内容中切分出题目材料与作答，兼容既有约定标记。"""
    content = (content or "").strip()
    if not content:
        return "", ""
    question, answer = content, ""
    for marker in ANSWER_MARKERS:
        idx = content.find(marker)
        if idx != -1:
            question = content[:idx].strip()
            answer = content[idx + len(marker):].strip()
            break
    for marker in QUESTION_MARKERS:
        if question.startswith(marker):
            question = question[len(marker):].strip()
            break
    return question, answer


def build_grader_prompt(question: str, answer: str, question_type: str = "概括题") -> str:
    """阅卷官 Prompt：只打分 / 扣分原因 / 评分依据，禁止润色改写。"""
    return f"""你是资深申论阅卷官，有20年阅卷经验。

=== 输入 ===
【题目材料与题干】
{question}

【学生作答】
{answer}

【题型】{question_type}

=== 唯一职责 ===
只做三件事：
1. 给出唯一总分（满分100分）
2. 列出主要失分点（2-4条，按影响程度排序，每条注明扣分原因与评分依据）
3. 给出评分依据（基于{question_type}的评分维度，说明每一维度的得分与扣分依据）

=== 硬性禁止（违反即不合格） ===
- 禁止润色学生原文
- 禁止改写学生句子
- 禁止给出任何"如何改进""可以这样写"之类的写作建议
- 禁止输出范文或示例段落

=== 输出格式 ===
只输出一个 JSON，禁止任何多余文字：
{{
  "total_score": 72,
  "score_breakdown": [
    {{"item": "内容要点", "full_score": 40, "actual_score": 28}}
  ],
  "main_deductions": [
    {{"reason": "概括要点遗漏，未覆盖材料中的具体内容", "deducted": 3}}
  ],
  "scoring_basis": "依据{question_type}评分标准：..."
}}"""


def build_coach_prompt(question: str, answer: str, question_type: str = "概括题") -> str:
    """写作教练 Prompt：只给修改建议 / 语言优化 / 示例改写，禁止打分与整篇范文。"""
    return f"""你是申论写作教练，擅长帮学生提升表达。

=== 输入 ===
【题目材料与题干】
{question}

【学生作答】
{answer}

【题型】{question_type}

=== 唯一职责 ===
逐段诊断学生作答，只给出：
1. 修改建议：该段应如何调整结构或内容
2. 语言优化：指出该段中表达不当之处并说明原因
3. 示例改写：对学生原文句子给出改写示范，格式"原句 → 优化句"并说明改写理由

=== 硬性禁止（违反即不合格） ===
- 禁止打分、禁止评论分数
- 禁止给出总分或任何分数
- 禁止输出整篇范文或标准答案（只允许针对学生句子的改写示范）

=== 输出格式 ===
只输出一个 JSON，禁止任何多余文字：
{{
  "paragraph_advice": [
    {{
      "paragraph": "第一段",
      "diagnosis": "该段存在的主要问题",
      "suggestions": ["建议1", "建议2"],
      "rewrites": [
        {{"original": "学生原句", "optimized": "优化后句子", "why": "改写理由"}}
      ]
    }}
  ],
  "overall_advice": "整体写作建议（可选）"
}}"""


def build_standard_answer_prompt(question: str, question_type: str = "概括题") -> str:
    """标准答案 Prompt：用户确认查看后触发，只依赖题目材料与题干，不输入学生作答。"""
    return f"""你是申论标准答案撰写专家。

=== 输入 ===
【题目材料与题干】
{question}

【题型】{question_type}

=== 任务 ===
1. 根据题目与材料撰写一篇完整标准答案范文
2. 给出标准答案解释：本题的答题要点、评分点、为什么这样答

=== 输出格式 ===
只输出一个 JSON，禁止任何多余文字：
{{
  "standard_answer": "完整范文",
  "explanation": "标准答案解释（答题要点与评分点说明）"
}}"""
