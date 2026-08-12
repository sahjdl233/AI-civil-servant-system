from pydantic import BaseModel, Field
from typing import List, Optional


class ScoreBreakdownItem(BaseModel):
    """阅卷官维度拆分"""
    item: str = Field(..., description="评分维度")
    full_score: float = Field(..., description="满分")
    actual_score: float = Field(..., description="实际得分")


class MainDeduction(BaseModel):
    """阅卷官主要失分点"""
    reason: str = Field(..., description="扣分原因")
    deducted: Optional[float] = Field(None, description="扣分值")


class GraderResult(BaseModel):
    """阅卷官结果"""
    total_score: float = Field(..., ge=0, le=100, description="唯一总分")
    score_breakdown: List[ScoreBreakdownItem] = Field(default=[], description="维度拆分")
    main_deductions: List[MainDeduction] = Field(default=[], description="主要失分")
    scoring_basis: str = Field(default="", description="评分依据")


class RewriteItem(BaseModel):
    """示例改写项"""
    original: str = Field(..., description="学生原句")
    optimized: str = Field(..., description="优化后句子")
    why: str = Field(default="", description="改写理由")


class ParagraphAdvice(BaseModel):
    """逐段写作建议"""
    paragraph: str = Field(..., description="段落标识，如第一段")
    diagnosis: str = Field(default="", description="该段问题诊断")
    suggestions: List[str] = Field(default=[], description="修改建议")
    rewrites: List[RewriteItem] = Field(default=[], description="示例改写")


class CoachResult(BaseModel):
    """写作教练结果"""
    paragraph_advice: List[ParagraphAdvice] = Field(default=[], description="按段落建议")
    overall_advice: str = Field(default="", description="整体写作建议")


class StandardAnswerResult(BaseModel):
    """标准答案生成结果"""
    standard_answer: str = Field(..., description="完整范文")
    explanation: str = Field(default="", description="标准答案解释")


class GradeDualRequest(BaseModel):
    """双角色批改请求"""
    content: str = Field(..., min_length=1, description="题目材料 + 作答")
    question_type: Optional[str] = Field(None, description="题型")
    provider_id: Optional[str] = Field(None, description="Provider ID，空则用默认模型")


class StandardAnswerRequest(BaseModel):
    """标准答案生成请求"""
    content: str = Field(..., min_length=1, description="题目材料 + 作答（仅取题目部分）")
    question_type: Optional[str] = Field(None, description="题型")
    provider_id: Optional[str] = Field(None, description="Provider ID，空则用默认模型")
    parent_id: Optional[str] = Field(None, description="关联的双角色批改历史记录 id")
