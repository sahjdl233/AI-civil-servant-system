from fastapi import APIRouter, HTTPException
from app.schemas.prompt import (
    PromptCreate,
    PromptUpdate,
    VersionSave,
    VersionPublish,
    ResetBuiltin,
    PreviewRequest,
    PreviewResult,
    DiffResult,
)
from app.services import prompt_library_service

router = APIRouter()


def _handle(e: Exception, prefix: str):
    if isinstance(e, KeyError):
        raise HTTPException(status_code=404, detail=str(e))
    if isinstance(e, ValueError):
        raise HTTPException(status_code=400, detail=str(e))
    raise HTTPException(status_code=500, detail=f"{prefix}: {str(e)}")


@router.get("/prompts")
async def list_prompts():
    """Prompt 模板列表（含已发布内容）"""
    try:
        return {"items": prompt_library_service.list_templates()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"读取 Prompt 库失败: {str(e)}")


@router.post("/prompts")
async def create_prompt(body: PromptCreate):
    """新增模板"""
    try:
        return prompt_library_service.create_template(body.model_dump())
    except Exception as e:
        _handle(e, "创建 Prompt 模板失败")


@router.get("/prompts/{template_id}")
async def get_prompt(template_id: str):
    """模板详情（含最新草稿内容）"""
    try:
        return prompt_library_service.get_template(template_id)
    except Exception as e:
        _handle(e, "读取 Prompt 模板失败")


@router.put("/prompts/{template_id}")
async def update_prompt(template_id: str, body: PromptUpdate):
    """更新模板元数据"""
    try:
        return prompt_library_service.update_template(template_id, body.model_dump(exclude_unset=True))
    except Exception as e:
        _handle(e, "更新 Prompt 模板失败")


@router.delete("/prompts/{template_id}")
async def delete_prompt(template_id: str):
    """删除模板（级联删除全部版本）"""
    try:
        prompt_library_service.delete_template(template_id)
        return {"ok": True}
    except Exception as e:
        _handle(e, "删除 Prompt 模板失败")


@router.get("/prompts/{template_id}/versions")
async def list_versions(template_id: str):
    """版本历史"""
    try:
        return {"items": prompt_library_service.list_versions(template_id)}
    except Exception as e:
        _handle(e, "读取版本列表失败")


@router.get("/prompts/{template_id}/versions/{version_id}")
async def get_version(template_id: str, version_id: str):
    """单版本完整内容"""
    try:
        return prompt_library_service.get_version(template_id, version_id)
    except Exception as e:
        _handle(e, "读取版本失败")


@router.post("/prompts/{template_id}/versions")
async def save_version(template_id: str, body: VersionSave):
    """保存新版本（可选发布）"""
    try:
        return prompt_library_service.save_version(
            template_id, body.content, body.change_note, body.publish
        )
    except Exception as e:
        _handle(e, "保存版本失败")


@router.post("/prompts/{template_id}/publish")
async def publish_version(template_id: str, body: VersionPublish):
    """发布指定版本（对旧版本执行即回滚）"""
    try:
        return prompt_library_service.publish_version(template_id, body.version_id)
    except Exception as e:
        _handle(e, "发布版本失败")


@router.post("/prompts/{template_id}/reset")
async def reset_builtin(template_id: str, body: ResetBuiltin):
    """重置为内置默认内容（生成新版本）"""
    try:
        return prompt_library_service.reset_to_builtin(template_id, body.change_note, body.publish)
    except Exception as e:
        _handle(e, "重置内置失败")


@router.post("/prompts/{template_id}/preview", response_model=PreviewResult)
async def preview_prompt(template_id: str, body: PreviewRequest):
    """服务端渲染预览（缺省用样例变量）"""
    try:
        return prompt_library_service.render_preview(template_id, body.vars)
    except Exception as e:
        _handle(e, "渲染预览失败")


@router.get("/prompts/{template_id}/diff", response_model=DiffResult)
async def diff_prompt(template_id: str, a: int, b: int):
    """版本行级对比"""
    try:
        return prompt_library_service.diff_versions(template_id, a, b)
    except Exception as e:
        _handle(e, "版本对比失败")
