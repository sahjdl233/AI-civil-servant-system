from pydantic import BaseModel, Field
from typing import List, Optional


class PromptTemplateInfo(BaseModel):
    """模板对外展示信息（含已发布内容）"""
    id: str = Field(..., description="模板 ID")
    key: str = Field(..., description="机器标识")
    name: str = Field(..., description="显示名")
    category: str = Field(..., description="分类")
    description: Optional[str] = Field(None, description="用途说明")
    is_active: bool = Field(True, description="是否启用")
    published_version: Optional[int] = Field(None, description="当前生效版本号")
    content: str = Field("", description="已发布版本内容")
    latest_version: Optional[int] = Field(None, description="最新版本号")
    version_count: int = Field(0, description="版本总数")
    created_at: Optional[str] = Field(None)
    updated_at: Optional[str] = Field(None)


class PromptCreate(BaseModel):
    """新增模板"""
    key: str = Field(..., min_length=1, max_length=100, description="机器标识，创建后只读")
    name: str = Field(..., min_length=1, max_length=100)
    category: str = Field("diagnosis", max_length=50)
    description: Optional[str] = Field(None, max_length=2000)
    content: str = Field(..., min_length=1, description="Prompt 正文（含 {{变量}} 占位符）")
    change_note: Optional[str] = Field(None, max_length=500)
    publish: bool = Field(True, description="是否立即发布")


class PromptUpdate(BaseModel):
    """更新模板元数据"""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    category: Optional[str] = Field(None, max_length=50)
    description: Optional[str] = Field(None, max_length=2000)
    is_active: Optional[bool] = Field(None)


class PromptVersionInfo(BaseModel):
    """版本信息"""
    id: str = Field(..., description="版本 ID")
    version: int = Field(..., description="版本号")
    content: str = Field(..., description="Prompt 快照")
    change_note: Optional[str] = Field(None, description="变更说明")
    is_published: bool = Field(False, description="是否生效")
    created_at: Optional[str] = Field(None)


class VersionSave(BaseModel):
    """保存新版本"""
    content: str = Field(..., min_length=1, max_length=102400, description="Prompt 正文")
    change_note: Optional[str] = Field(None, max_length=500)
    publish: bool = Field(False, description="保存并发布")


class VersionPublish(BaseModel):
    """发布指定版本（回滚入口）"""
    version_id: str = Field(..., description="目标版本 ID")


class ResetBuiltin(BaseModel):
    """重置为内置默认"""
    change_note: Optional[str] = Field(None, max_length=500)
    publish: bool = Field(False)


class PreviewRequest(BaseModel):
    """渲染预览"""
    vars: Optional[dict] = Field(None, description="覆盖的样例变量")


class PreviewResult(BaseModel):
    key: str = Field(..., description="模板 key")
    rendered: str = Field(..., description="渲染后文本")


class DiffOp(BaseModel):
    op: str = Field(..., description="eq|add|del")
    line: str = Field(..., description="行内容")


class DiffResult(BaseModel):
    version_a: int = Field(...)
    version_b: int = Field(...)
    ops: List[DiffOp] = Field(default=[])
