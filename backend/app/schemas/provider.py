from pydantic import BaseModel, Field
from typing import List, Optional


class ProviderInfo(BaseModel):
    """Provider 对外展示信息（api_key 脱敏）"""
    id: str = Field(..., description="Provider ID")
    name: str = Field(..., description="显示名")
    provider_type: str = Field(..., description="类型 openai|claude|gemini|deepseek|qwen|custom")
    base_url: Optional[str] = Field(None, description="Base URL")
    model: str = Field(..., description="模型名")
    is_default: bool = Field(False, description="是否默认")
    is_enabled: bool = Field(True, description="是否启用")
    timeout: int = Field(180, description="请求超时（秒）")
    api_key_masked: str = Field("", description="脱敏后的密钥，如 sk-***last4")


class ProviderCreate(BaseModel):
    """新增 Provider"""
    name: str = Field(..., min_length=1, max_length=100)
    provider_type: str = Field(..., pattern=r"^(openai|claude|gemini|deepseek|qwen|custom)$")
    base_url: Optional[str] = Field(None, max_length=500)
    api_key: str = Field(..., min_length=1)
    model: str = Field(..., min_length=1, max_length=100)
    is_default: bool = Field(False)
    is_enabled: bool = Field(True)
    timeout: int = Field(180, ge=1, le=600)
    extra: Optional[dict] = Field(None)


class ProviderUpdate(BaseModel):
    """更新 Provider（api_key 留空表示保留原值）"""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    provider_type: Optional[str] = Field(None, pattern=r"^(openai|claude|gemini|deepseek|qwen|custom)$")
    base_url: Optional[str] = Field(None, max_length=500)
    api_key: Optional[str] = Field(None, description="留空则保留原值")
    model: Optional[str] = Field(None, min_length=1, max_length=100)
    is_default: Optional[bool] = Field(None)
    is_enabled: Optional[bool] = Field(None)
    timeout: Optional[int] = Field(None, ge=1, le=600)
    extra: Optional[dict] = Field(None)


class ProviderTestResult(BaseModel):
    ok: bool = Field(..., description="是否连通")
    message: str = Field(..., description="结果消息")
    latency_ms: Optional[int] = Field(None, description="耗时")


class MultiGradingRequest(BaseModel):
    """多模型评分请求"""
    content: str = Field(..., min_length=1, description="题目材料 + 作答")
    question_type: Optional[str] = Field(None, description="题型")
    provider_ids: List[str] = Field(default=[], description="选中的 Provider ID 列表，空则用默认模型")
    consensus: bool = Field(False, description="是否生成 AI 共识汇总（Consensus Prompt）")
