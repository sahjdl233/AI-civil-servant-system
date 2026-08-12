from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from app.schemas.dual_role import GradeDualRequest, StandardAnswerRequest
from app.services.grading.dual_role import grade_dual_stream
from app.services.grading.standard_answer import generate_standard_answer
from app.services.grading.orchestrator import detect_question_type
from app.services.history_service import append_history
from app.services.providers import ProviderNotFoundError, ProviderRegistry
import json
import logging
from typing import Optional

router = APIRouter()
logger = logging.getLogger(__name__)


async def _resolve_provider(provider_id: Optional[str]):
    """按 provider_id 或默认 Provider 解析；异常抛出对应 HTTP 错误。"""
    registry = ProviderRegistry.get_instance()
    try:
        if provider_id:
            return await registry.get(provider_id)
        return await registry.get_default()
    except ProviderNotFoundError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/essays/grade-dual")
async def grade_essay_dual(submission: GradeDualRequest):
    """
    双角色 AI 批改（SSE 流式）。
    阅卷官（打分/扣分原因/评分依据）与写作教练（修改建议/语言优化/示例改写）
    并行独立执行，Prompt 完全独立，单角色失败不影响另一个。
    事件流：roles_started -> role_start x2 -> role_result|role_error x2 -> done
    """
    logger.info("=== 双角色 AI 批改开始 ===")
    logger.info(f"Content length: {len(submission.content)}")

    # 题型识别（一次，两角色复用）
    qtype, qsource = await detect_question_type(submission.content, submission.question_type)
    provider = await _resolve_provider(submission.provider_id)

    async def generate():
        try:
            final_event = None
            async for event in grade_dual_stream(provider, submission.content, qtype):
                if event.get("type") in ("roles_started", "done"):
                    event["questionType"] = qtype
                    event["questionTypeSource"] = qsource
                if event.get("type") == "done":
                    final_event = event
                yield (f"data: {json.dumps(event, ensure_ascii=False)}\n\n").encode(
                    "utf-8", errors="replace"
                )

            # 持久化历史（评分取阅卷官总分）
            if final_event:
                score = None
                grader = final_event.get("grader")
                if grader and isinstance(grader, dict):
                    try:
                        score = float(grader.get("total_score"))
                    except (TypeError, ValueError):
                        score = None
                response_data = {
                    "grader": final_event.get("grader"),
                    "coach": final_event.get("coach"),
                    "combined": final_event.get("combined"),
                    "questionType": qtype,
                    "questionTypeSource": qsource,
                }
                if score is not None:
                    response_data["score"] = score
                try:
                    record_id = append_history(
                        kind="grade_dual",
                        request={
                            "content": submission.content,
                            "question_type": submission.question_type,
                            "provider_id": submission.provider_id,
                        },
                        response=response_data,
                    )
                    # 将历史记录 id 下发给前端，用于标准答案关联
                    yield (f"data: {json.dumps({'type': 'history_saved', 'recordId': record_id}, ensure_ascii=False)}\n\n").encode(
                        "utf-8", errors="replace"
                    )
                except Exception as e:
                    logger.warning("双角色批改历史保存失败: %s", str(e))
        except Exception as e:
            logger.error("双角色批改异常: %s", str(e))
            error_event = {
                "type": "error",
                "status": "批改失败",
                "message": "AI 批改服务异常，请稍后重试",
                "error": str(e)[:200],
            }
            yield (f"data: {json.dumps(error_event, ensure_ascii=False)}\n\n").encode(
                "utf-8", errors="replace"
            )

    return StreamingResponse(
        generate(),
        media_type="text/event-stream; charset=utf-8",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/essays/standard-answer")
async def get_standard_answer(submission: StandardAnswerRequest):
    """
    标准答案按需生成（用户确认"是否需要查看标准答案"后触发）。
    返回整篇范文与标准答案解释，仅依赖题目材料与题型。
    """
    logger.info("=== 标准答案按需生成开始 ===")
    try:
        provider = await _resolve_provider(submission.provider_id)
        result = await generate_standard_answer(provider, submission.content, submission.question_type)

        response_data = {
            "standardAnswer": result.standard_answer,
            "explanation": result.explanation,
        }
        try:
            append_history(
                kind="standard_answer",
                request={
                    "content": submission.content,
                    "question_type": submission.question_type,
                },
                response=response_data,
                extra={"parent_id": submission.parent_id} if submission.parent_id else None,
            )
        except Exception as e:
            logger.warning("标准答案历史保存失败: %s", str(e))
        return response_data
    except Exception as e:
        logger.error("标准答案生成失败: %s", str(e))
        err = str(e).lower()
        if "api_key" in err or "authentication" in err or "unauthorized" in err:
            raise HTTPException(status_code=503, detail="AI 认证异常，请稍后重试")
        if "connection" in err or "timeout" in err or "network" in err:
            raise HTTPException(status_code=504, detail="网络超时，请稍后重试")
        if "rate_limit" in err or "quota" in err:
            raise HTTPException(status_code=429, detail="请求过多，请稍后再试")
        raise HTTPException(status_code=500, detail="标准答案生成失败，请稍后重试")
