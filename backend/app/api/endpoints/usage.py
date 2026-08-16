from fastapi import APIRouter, HTTPException
from app.services import usage_service

router = APIRouter()


@router.get("/usage/stats")
async def usage_stats(
    range: str = "today",
    group_by: str = "provider",
    exclude_test: bool = True,
):
    """Token 消耗统计（后台成本控制）。

    参数：
      range: today | yesterday | 7d | 30d | all
      group_by: provider | model | scene
      exclude_test: 是否剔除连通性测试的小调用（默认 true）
    """
    try:
        return usage_service.get_stats(
            range_key=range,
            group_by=group_by,
            exclude_test=exclude_test,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"读取 Token 统计失败: {str(e)}")
