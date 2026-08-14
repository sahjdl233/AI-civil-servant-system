#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
简化版的prompt服务 - 修复f-string问题
支持不同题型的评分维度

诊断与整体评价 Prompt 均为「库优先、内置兜底」：已发布模板（Prompt Library）
优先，未发布/停用时回退内置默认（prompt_defaults，与种子同源）。
动态维度 JSON 与四步法描述仍由代码生成，注入 {{dimensions}} / {{methodology_description}}。
"""

from app.services import prompt_library_service


def get_question_type_dimensions(question_type: str) -> dict:
    """根据题型返回对应的评分维度和满分 - 基于申论四大题型核心秘籍"""

    dimensions_mapping = {
        "概括题": {
            "审题定标": 25,      # 第一步：审题定标——明确"概括谁"、"在哪找"、"怎么答"
            "精准找点": 30,      # 第二步：精准找点——遵循材料，地毯式搜寻关键信息
            "逻辑归并": 25,      # 第三步：逻辑归并——分类合并，提炼升华核心要点
            "规范成文": 20       # 第四步：规范成文——总分有序，清晰呈现
        },
        "综合分析题": {
            "审题拆解": 25,      # 第一步：审题拆解——识别分析类型，锁定核心对象
            "搜寻组件": 25,      # 第二步：搜寻组件——带着问题阅读，寻找逻辑关系
            "逻辑重构": 30,      # 第三步：逻辑重构——搭建分析框架，串联论证链条
            "规范作答": 20       # 第四步：规范作答——观点前置，论述清晰
        },
        "对策题": {
            "问题诊断": 25,      # 第一步：精准问题诊断——找到"病根"，才能开"药方"
            "角色定位": 20,      # 第二步：角色定位与视角锁定——"谁来解决"，决定"能怎么解决"
            "寻找对策": 30,      # 第三步：从材料中寻找对策来源——对策是"找"与"创"的结合
            "结构呈现": 25       # 第四步：结构化与"动词化"呈现——让对策清晰有力，具备可操作性
        },
        "应用文写作题": {
            "情境解构": 25,      # 第一步：情境解构（黄金三问）——我是谁？写给谁？为什么写？
            "格式遵从": 20,      # 第二步：格式遵从——"穿对衣服"，才能"登对场合"
            "内容组织": 30,      # 第三步：内容组织与逻辑构建——言之有物，条理清晰
            "语言匹配": 25       # 第四步：语言风格与语气匹配——"说什么话"，要看"对谁说"
        }
    }

    # 默认使用概括题的维度
    return dimensions_mapping.get(question_type, dimensions_mapping["概括题"])


def get_methodology_description(question_type: str) -> str:
    """根据题型返回对应的四步法方法论描述"""

    methodology_descriptions = {
        "概括题": """
第一步：审题定标——明确"概括谁"、"在哪找"、"怎么答"
第二步：精准找点——遵循材料，地毯式搜寻关键信息
第三步：逻辑归并——分类合并，提炼升华核心要点
第四步：规范成文——总分有序，清晰呈现
        """,

        "综合分析题": """
第一步：审题拆解——识别分析类型，锁定核心对象
第二步：搜寻组件——带着问题阅读，寻找逻辑关系
第三步：逻辑重构——搭建分析框架，串联论证链条
第四步：规范作答——观点前置，论述清晰
        """,

        "对策题": """
第一步：精准问题诊断——找到"病根"，才能开"药方"
第二步：角色定位与视角锁定——"谁来解决"，决定"能怎么解决"
第三步：从材料中寻找对策来源——对策是"找"与"创"的结合
第四步：结构化与"动词化"呈现——让对策清晰有力，具备可操作性
        """,

        "应用文写作题": """
第一步：情境解构（黄金三问）——我是谁？写给谁？为什么写？
第二步：格式遵从——"穿对衣服"，才能"登对场合"
第三步：内容组织与逻辑构建——言之有物，条理清晰
第四步：语言风格与语气匹配——"说什么话"，要看"对谁说"
        """
    }

    return methodology_descriptions.get(question_type, methodology_descriptions["概括题"]).strip()


def _build_dimensions_json(question_type: str) -> str:
    """按题型动态生成维度 JSON 块（含 HTML 样式与评分提示）。"""
    dimensions = get_question_type_dimensions(question_type)

    dimensions_json = ""
    for dim_name, max_score in dimensions.items():
        # 根据维度权重智能设置初始分数
        initial_score = int(max_score * 0.75)  # 默认75%作为基准

        dimensions_json += '''    "{}": {{
      "score": {},
      "feedback": "<span style='color: #1e40af; font-weight: bold;'>【得分点】</span>\n• 对学生表现出色的地方进行具体分析，如有具体表述可引用，格式为：'学生的具体表述' - 说明为什么这体现了{}能力\n• 分析优秀之处和加分因素\n\n<span style='color: #1e40af; font-weight: bold;'>【扣分点】</span>\n• 指出学生答题中的具体问题，如有问题表述可引用则引用\n• 分析失分原因和改进空间\n\n<span style='color: #1e40af; font-weight: bold;'>【改进方向】</span>\n• 提供3-4条具体可操作的改进建议\n• 如需改写示例，格式为：原表述'...' → 建议改为'...'，说明改进理由\n\n要求：尽量引用学生具体表述进行分析，但应自然合理，不可强求。深度分析，字数150-200字"
    }},
'''.format(dim_name, initial_score, dim_name)

    # 移除最后的逗号
    return dimensions_json.rstrip(',\n')


def create_expert_diagnosis_prompt(essay_content: str, question_type: str) -> str:
    """创建专家诊断式批改prompt - 增强版本，基于申论四大题型核心秘籍"""
    key = prompt_library_service.resolve_diagnosis_key(question_type)
    vars = {
        "question_type": question_type,
        "essay_content": essay_content,
        "dimensions": _build_dimensions_json(question_type),
        "methodology_description": get_methodology_description(question_type),
    }
    rendered = prompt_library_service.render_template(key, vars)
    if rendered is not None:
        return rendered
    return prompt_library_service.render_default_template(key, vars)


def create_overall_evaluation_prompt(diagnosis_result: dict, essay_content: str, question_type: str) -> str:
    """创建整体评价prompt - 增强版本，基于诊断结果生成高质量总评"""
    vars = {
        "question_type": question_type,
        "diagnosis_result": str(diagnosis_result),
        "essay_content": essay_content,
    }
    rendered = prompt_library_service.render_template("overall_evaluation", vars)
    if rendered is not None:
        return rendered
    return prompt_library_service.render_default_template("overall_evaluation", vars)
