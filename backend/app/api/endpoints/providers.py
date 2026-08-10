from fastapi import APIRouter, HTTPException
from app.schemas.provider import (
    ProviderCreate,
    ProviderUpdate,
    ProviderTestResult,
)
from app.services import provider_service

router = APIRouter()


@router.get("/providers")
async def list_providers():
    """Provider 列表（api_key 脱敏）"""
    try:
        return {"items": provider_service.list_providers()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"读取 Provider 失败: {str(e)}")


@router.post("/providers")
async def create_provider(body: ProviderCreate):
    """新增 Provider"""
    try:
        data = body.model_dump()
        created = provider_service.create_provider(data)
        await provider_service.invalidate_registry()
        return created
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"创建 Provider 失败: {str(e)}")


@router.put("/providers/{provider_id}")
async def update_provider(provider_id: str, body: ProviderUpdate):
    """更新 Provider（api_key 留空表示保留原值）"""
    try:
        updated = provider_service.update_provider(provider_id, body.model_dump(exclude_unset=True))
        await provider_service.invalidate_registry()
        return updated
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"更新 Provider 失败: {str(e)}")


@router.delete("/providers/{provider_id}")
async def delete_provider(provider_id: str):
    """删除 Provider（默认 Provider 不允许删除）"""
    try:
        provider_service.delete_provider(provider_id)
        await provider_service.invalidate_registry()
        return {"ok": True}
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"删除 Provider 失败: {str(e)}")


@router.post("/providers/{provider_id}/test")
async def test_provider(provider_id: str) -> ProviderTestResult:
    """连通性测试"""
    try:
        return await provider_service.test_provider(provider_id)
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"测试 Provider 失败: {str(e)}")
