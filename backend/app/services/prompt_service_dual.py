#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
双角色批改独立 Prompt 构建器。

阅卷官、写作教练、标准答案三个 Prompt 完全独立：
- 均由同一份原始输入（题目材料 + 作答 + 题型）独立构建
- 互相不引用对方的输出
- 各自的"硬性禁止"段限定职责边界

均为「库优先、内置兜底」：已发布模板（Prompt Library）优先，
未发布/停用时回退到内置默认（prompt_defaults，与种子同源）。
"""

from app.services import prompt_library_service

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


def _render_or_default(key: str, vars: dict) -> str:
    """库优先渲染，未发布/停用则回退内置默认。"""
    rendered = prompt_library_service.render_template(key, vars)
    if rendered is not None:
        return rendered
    return prompt_library_service.render_default_template(key, vars)


def build_grader_prompt(question: str, answer: str, question_type: str = "概括题") -> str:
    """阅卷官 Prompt：只打分 / 扣分原因 / 评分依据，禁止润色改写。"""
    return _render_or_default(
        "grader_prompt",
        {"question": question, "answer": answer, "question_type": question_type},
    )


def build_coach_prompt(question: str, answer: str, question_type: str = "概括题") -> str:
    """写作教练 Prompt：只给修改建议 / 语言优化 / 示例改写，禁止打分与整篇范文。"""
    return _render_or_default(
        "coach_prompt",
        {"question": question, "answer": answer, "question_type": question_type},
    )


def build_standard_answer_prompt(question: str, question_type: str = "概括题") -> str:
    """标准答案 Prompt：用户确认查看后触发，只依赖题目材料与题干，不输入学生作答。"""
    return _render_or_default(
        "standard_answer",
        {"question": question, "question_type": question_type},
    )
