#!/usr/bin/env python3
"""
从答案文档中提取答案和解析的脚本
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from docx import Document
from app.db.database import SessionLocal
from app.models.question import Question
import re
import json

def extract_answers_from_docx(docx_path):
    """从Word文档中提取答案和解析"""
    
    print(f"正在处理文档: {docx_path}")
    
    try:
        doc = Document(docx_path)
        answers_data = {}
        
        current_question_num = None
        current_answer = None
        current_explanation = []
        
        for para in doc.paragraphs:
            text = para.text.strip()
            if not text:
                continue
            
            # 匹配题目编号和答案，如: "1.B" 或 "1、B" 或 "1. B"
            answer_match = re.match(r'^(\d+)[\s\.\、]*([A-D])\s*$', text)
            if answer_match:
                # 保存上一题的数据
                if current_question_num and current_answer:
                    answers_data[current_question_num] = {
                        'answer': current_answer,
                        'explanation': '\n'.join(current_explanation).strip()
                    }
                
                # 开始新题
                current_question_num = int(answer_match.group(1))
                current_answer = answer_match.group(2)
                current_explanation = []
                print(f"找到题目 {current_question_num} 答案: {current_answer}")
                continue
            
            # 匹配带解析的答案，如: "1.B 解析：..."
            answer_with_explanation = re.match(r'^(\d+)[\s\.\、]*([A-D])\s*(.+)$', text)
            if answer_with_explanation:
                question_num = int(answer_with_explanation.group(1))
                answer = answer_with_explanation.group(2)
                explanation = answer_with_explanation.group(3)
                
                # 清理解析文本
                explanation = re.sub(r'^[解析析：:]\s*', '', explanation)
                
                answers_data[question_num] = {
                    'answer': answer,
                    'explanation': explanation.strip()
                }
                print(f"找到题目 {question_num} 答案: {answer} (含解析)")
                continue
            
            # 如果当前正在处理某题，将文本作为解析内容
            if current_question_num and text:
                # 跳过明显的标题或分隔符
                if not re.match(r'^[一二三四五六七八九十]+[\s\.\、]', text) and \
                   not text.startswith('第') and \
                   len(text) > 5:
                    current_explanation.append(text)
        
        # 保存最后一题
        if current_question_num and current_answer:
            answers_data[current_question_num] = {
                'answer': current_answer,
                'explanation': '\n'.join(current_explanation).strip()
            }
        
        print(f"从文档中提取到 {len(answers_data)} 道题目的答案")
        return answers_data
        
    except Exception as e:
        print(f"处理文档时出错: {e}")
        return {}

def update_database_with_answers(answers_data):
    """将答案数据更新到数据库"""
    
    db = SessionLocal()
    try:
        print("=== 开始更新数据库 ===")
        
        updated_count = 0
        not_found_count = 0
        
        for question_number, data in answers_data.items():
            answer = data.get("answer", "")
            explanation = data.get("explanation", "")
            
            # 查找对应的题目
            question = db.query(Question).filter(
                Question.question_number == question_number
            ).first()
            
            if question:
                # 更新答案
                question.answer = answer
                
                # 更新解析（如果有）
                if explanation:
                    question.answer_explanation = explanation
                
                print(f"题目{question_number}: 答案={answer}, 解析={len(explanation)}字符")
                updated_count += 1
            else:
                print(f"❌ 未找到题目编号: {question_number}")
                not_found_count += 1
        
        # 提交更改
        db.commit()
        
        print(f"\n=== 更新完成 ===")
        print(f"成功更新: {updated_count} 道题目")
        print(f"未找到: {not_found_count} 道题目")
        
        # 显示更新后的统计
        total_questions = db.query(Question).count()
        questions_with_answer = db.query(Question).filter(
            Question.answer.isnot(None),
            Question.answer != ''
        ).count()
        questions_with_explanation = db.query(Question).filter(
            Question.answer_explanation.isnot(None),
            Question.answer_explanation != ''
        ).count()
        
        print(f"\n数据库统计:")
        print(f"总题目数: {total_questions}")
        print(f"有答案的题目数: {questions_with_answer}")
        print(f"有解析的题目数: {questions_with_explanation}")
        
    except Exception as e:
        print(f"更新数据库时发生错误: {e}")
        db.rollback()
    finally:
        db.close()

def main():
    """主函数"""
    
    # 查找答案文档
    answer_files = []
    uploads_dir = "uploads"
    
    for filename in os.listdir(uploads_dir):
        if "答案" in filename and filename.endswith('.docx'):
            answer_files.append(os.path.join(uploads_dir, filename))
    
    if not answer_files:
        print("未找到包含'答案'的Word文档")
        return
    
    print(f"找到 {len(answer_files)} 个答案文档:")
    for f in answer_files:
        print(f"  - {f}")
    
    # 提取所有答案数据
    all_answers = {}
    
    for answer_file in answer_files:
        answers = extract_answers_from_docx(answer_file)
        all_answers.update(answers)
    
    if all_answers:
        print(f"\n总共提取到 {len(all_answers)} 道题目的答案")
        
        # 显示前几个示例
        print("\n前5个答案示例:")
        for i, (num, data) in enumerate(sorted(all_answers.items())[:5]):
            print(f"题目{num}: {data['answer']} - {data['explanation'][:50]}...")
        
        # 询问是否更新数据库
        response = input("\n是否将这些答案更新到数据库? (y/n): ")
        if response.lower() == 'y':
            update_database_with_answers(all_answers)
        else:
            print("已取消更新")
    else:
        print("未提取到任何答案数据")

if __name__ == "__main__":
    main()