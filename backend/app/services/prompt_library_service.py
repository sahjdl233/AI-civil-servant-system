#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Prompt Library 服务：模板 CRUD、版本管理、发布/回滚、渲染、缓存与启动种子。

对外返回 dict，供 API 端点直接响应。运行时侧 render_template 被业务 Prompt
构建器调用，实现「库优先、内置兜底」。
"""

import logging
import re
import time
import uuid
from datetime import datetime
from typing import List, Optional

from app.db.database import SessionLocal
from app.models.prompt import PromptTemplate, PromptVersion
from app.services import prompt_defaults

logger = logging.getLogger(__name__)

# 占位符 {{变量}} 正则（白名单：字母/数字/下划线）
_PLACEHOLDER_RE = re.compile(r"\{\{(\w+)\}\}")

# 题型 -> 诊断模板 key 映射
TYPE_KEY_MAP = {
    "概括题": "diagnosis_summary",
    "综合分析题": "diagnosis_analysis",
    "对策题": "diagnosis_countermeasure",
    "应用文写作题": "diagnosis_practical",
    "作文": "diagnosis_essay",
    "大作文": "diagnosis_essay",
}

# 运行时缓存：key -> (expire_at, entry)；entry 为 None 表示负缓存（不可用）
_cache: dict[str, tuple[float, Optional[dict]]] = {}
CACHE_TTL = 60  # 秒


def resolve_diagnosis_key(question_type: str) -> str:
    """题型 -> 诊断模板 key；未知题型回退概括题模板。"""
    return TYPE_KEY_MAP.get(question_type, "diagnosis_summary")


def _render(content: str, vars: dict) -> str:
    """渲染 {{变量}} 占位符；缺失变量渲染为空串并告警；未知变量不替换。"""

    def _sub(m: re.Match) -> str:
        name = m.group(1)
        if name in vars:
            return str(vars[name])
        logger.warning("Prompt 渲染缺少变量: %s", name)
        return ""

    return _PLACEHOLDER_RE.sub(_sub, content)


def _template_public(row: PromptTemplate, db) -> dict:
    """模板对外结构：含已发布内容、最新版本号、版本数。"""
    published = (
        db.query(PromptVersion)
        .filter(PromptVersion.template_id == row.id, PromptVersion.is_published.is_(True))
        .first()
    )
    latest = (
        db.query(PromptVersion)
        .filter(PromptVersion.template_id == row.id)
        .order_by(PromptVersion.version.desc())
        .first()
    )
    return {
        "id": row.id,
        "key": row.key,
        "name": row.name,
        "category": row.category,
        "description": row.description,
        "is_active": bool(row.is_active),
        "published_version": published.version if published else None,
        "content": published.content if published else "",
        "latest_version": latest.version if latest else None,
        "version_count": db.query(PromptVersion)
        .filter(PromptVersion.template_id == row.id)
        .count(),
        "created_at": row.created_at.isoformat() if row.created_at else None,
        "updated_at": row.updated_at.isoformat() if row.updated_at else None,
    }


def _version_public(row: PromptVersion) -> dict:
    return {
        "id": row.id,
        "version": row.version,
        "content": row.content,
        "change_note": row.change_note,
        "is_published": bool(row.is_published),
        "created_at": row.created_at.isoformat() if row.created_at else None,
    }


def _get_template_or_raise(db, template_id: str) -> PromptTemplate:
    row = db.query(PromptTemplate).filter(PromptTemplate.id == template_id).first()
    if not row:
        raise KeyError(f"Prompt 模板不存在: {template_id}")
    return row


def _next_version(db, template_id: str) -> int:
    cur = db.query(PromptVersion).filter(PromptVersion.template_id == template_id).count()
    return cur + 1


def _unpublish_all(db, template_id: str) -> None:
    db.query(PromptVersion).filter(
        PromptVersion.template_id == template_id
    ).update({PromptVersion.is_published: False})


# ---------- 管理侧 CRUD ----------

def list_templates() -> List[dict]:
    with SessionLocal() as db:
        rows = db.query(PromptTemplate).order_by(PromptTemplate.category.asc(), PromptTemplate.created_at.asc()).all()
        return [_template_public(r, db) for r in rows]


def get_template(template_id: str) -> dict:
    with SessionLocal() as db:
        row = _get_template_or_raise(db, template_id)
        data = _template_public(row, db)
        latest = (
            db.query(PromptVersion)
            .filter(PromptVersion.template_id == row.id)
            .order_by(PromptVersion.version.desc())
            .first()
        )
        data["draft_content"] = latest.content if latest else ""
        return data


def create_template(data: dict) -> dict:
    key = (data.get("key") or "").strip()
    if not key:
        raise ValueError("key 不能为空")
    with SessionLocal() as db:
        exists = db.query(PromptTemplate).filter(PromptTemplate.key == key).first()
        if exists:
            raise ValueError(f"key 已存在: {key}")
        content = data.get("content") or ""
        if not content.strip():
            raise ValueError("content 不能为空")
        row = PromptTemplate(
            id=str(uuid.uuid4()),
            key=key,
            name=data.get("name") or key,
            category=data.get("category") or "diagnosis",
            description=data.get("description"),
            is_active=bool(data.get("is_active", True)),
        )
        db.add(row)
        db.commit()
        db.refresh(row)
        ver = PromptVersion(
            id=str(uuid.uuid4()),
            template_id=row.id,
            version=1,
            content=content,
            change_note=data.get("change_note") or "初始版本",
            is_published=bool(data.get("publish", True)),
        )
        db.add(ver)
        db.commit()
        _invalidate_key(key)
        return _template_public(row, db)


def update_template(template_id: str, data: dict) -> dict:
    with SessionLocal() as db:
        row = _get_template_or_raise(db, template_id)
        old_key = row.key
        if data.get("name") is not None:
            row.name = data["name"]
        if data.get("category") is not None:
            row.category = data["category"]
        if "description" in data:
            row.description = data["description"]
        if data.get("is_active") is not None:
            row.is_active = bool(data["is_active"])
        row.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(row)
        _invalidate_key(old_key)
        _invalidate_key(row.key)
        return _template_public(row, db)


def delete_template(template_id: str) -> None:
    with SessionLocal() as db:
        row = _get_template_or_raise(db, template_id)
        key = row.key
        db.query(PromptVersion).filter(PromptVersion.template_id == template_id).delete()
        db.delete(row)
        db.commit()
        _invalidate_key(key)


# ---------- 版本管理 ----------

def list_versions(template_id: str) -> List[dict]:
    with SessionLocal() as db:
        _get_template_or_raise(db, template_id)
        rows = (
            db.query(PromptVersion)
            .filter(PromptVersion.template_id == template_id)
            .order_by(PromptVersion.version.desc())
            .all()
        )
        return [_version_public(r) for r in rows]


def get_version(template_id: str, version_id: str) -> dict:
    with SessionLocal() as db:
        _get_template_or_raise(db, template_id)
        row = (
            db.query(PromptVersion)
            .filter(PromptVersion.template_id == template_id, PromptVersion.id == version_id)
            .first()
        )
        if not row:
            raise KeyError(f"版本不存在: {version_id}")
        return _version_public(row)


def save_version(template_id: str, content: str, change_note: Optional[str], publish: bool = False) -> dict:
    if not content or not content.strip():
        raise ValueError("content 不能为空")
    with SessionLocal() as db:
        row = _get_template_or_raise(db, template_id)
        if publish:
            _unpublish_all(db, row.id)
        ver = PromptVersion(
            id=str(uuid.uuid4()),
            template_id=row.id,
            version=_next_version(db, row.id),
            content=content,
            change_note=(change_note or "").strip() or "更新",
            is_published=publish,
        )
        db.add(ver)
        row.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(ver)
        _invalidate_key(row.key)
        return _version_public(ver)


def publish_version(template_id: str, version_id: str) -> dict:
    with SessionLocal() as db:
        row = _get_template_or_raise(db, template_id)
        ver = (
            db.query(PromptVersion)
            .filter(PromptVersion.template_id == template_id, PromptVersion.id == version_id)
            .first()
        )
        if not ver:
            raise KeyError(f"版本不存在: {version_id}")
        _unpublish_all(db, row.id)
        ver.is_published = True
        row.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(ver)
        _invalidate_key(row.key)
        return _version_public(ver)


def reset_to_builtin(template_id: str, change_note: Optional[str], publish: bool = False) -> dict:
    with SessionLocal() as db:
        row = _get_template_or_raise(db, template_id)
        builtin = prompt_defaults.DEFAULT_TEMPLATES.get(row.key)
        if builtin is None:
            raise ValueError(f"该模板没有内置默认内容: {row.key}")
        content = builtin["content"]
        if publish:
            _unpublish_all(db, row.id)
        ver = PromptVersion(
            id=str(uuid.uuid4()),
            template_id=row.id,
            version=_next_version(db, row.id),
            content=content,
            change_note=(change_note or "").strip() or "重置为内置默认",
            is_published=publish,
        )
        db.add(ver)
        row.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(ver)
        _invalidate_key(row.key)
        return _version_public(ver)


def diff_versions(template_id: str, a: int, b: int) -> dict:
    import difflib

    with SessionLocal() as db:
        _get_template_or_raise(db, template_id)
        va = (
            db.query(PromptVersion)
            .filter(PromptVersion.template_id == template_id, PromptVersion.version == a)
            .first()
        )
        vb = (
            db.query(PromptVersion)
            .filter(PromptVersion.template_id == template_id, PromptVersion.version == b)
            .first()
        )
        if not va or not vb:
            raise KeyError(f"版本不存在: {a} 或 {b}")
        lines_a = va.content.splitlines()
        lines_b = vb.content.splitlines()
    ops: list[dict] = []
    sm = difflib.SequenceMatcher(a=lines_a, b=lines_b, autojunk=False)
    for tag, i1, i2, j1, j2 in sm.get_opcodes():
        for line in lines_a[i1:i2]:
            ops.append({"op": "del" if tag != "equal" else "eq", "line": line})
        for line in lines_b[j1:j2]:
            ops.append({"op": "add" if tag != "equal" else "eq", "line": line})
    return {"version_a": a, "version_b": b, "ops": ops}


def render_preview(template_id: str, vars: Optional[dict] = None) -> dict:
    with SessionLocal() as db:
        row = _get_template_or_raise(db, template_id)
        published = (
            db.query(PromptVersion)
            .filter(PromptVersion.template_id == row.id, PromptVersion.is_published.is_(True))
            .first()
        )
        if published is None:
            raise ValueError("该模板尚未发布，无法预览")
        content = published.content
    resolved = dict(_sample_vars(row.key))
    if vars:
        resolved.update({k: str(v) for k, v in vars.items()})
    return {"key": row.key, "rendered": _render(content, resolved)}


def _sample_vars(key: str) -> dict:
    """预览样例变量：尽可能覆盖该模板用到的占位符。"""
    samples = {
        "question_type": "概括题",
        "question": "【样例】请概括材料中 S 市提升基层治理能力的做法。",
        "answer": "【样例】一、网格化管理，责任到人。……",
        "essay_content": "【样例】我的作答内容……",
        "dimensions": '    "审题定标": {\n      "score": 20,\n      "feedback": "……"\n    },',
        "methodology_description": "第一步：审题定标——明确'概括谁'。\n第二步：精准找点——地毯式搜寻关键信息。",
        "diagnosis_result": '{"total_score": 72, "summary": "样例诊断结果"}',
        "chapter_content": "第一章：概括题……（样例章节）",
        "model_results": '[{"provider": "模型A", "score": 74, "feedback": "……"}]',
        "aggregate": '{"avgScore": 74, "maxScore": 78, "minScore": 70}',
        "knowledge_base": "《申论四大题型核心秘籍》样例……",
    }
    return samples


# ---------- 运行时侧 ----------

def _load_available(key: str) -> Optional[dict]:
    """查询库中可用模板（存在、激活、已发布）。返回 {content} 或 None。"""
    with SessionLocal() as db:
        row = db.query(PromptTemplate).filter(PromptTemplate.key == key).first()
        if not row or not row.is_active:
            return None
        published = (
            db.query(PromptVersion)
            .filter(PromptVersion.template_id == row.id, PromptVersion.is_published.is_(True))
            .first()
        )
        if published is None or not published.content.strip():
            return None
        return {"content": published.content}


def _invalidate_key(key: str) -> None:
    _cache.pop(key, None)


def _cache_get(key: str) -> Optional[dict]:
    entry = _cache.get(key)
    if entry is None:
        return None
    expire_at, value = entry
    if time.time() > expire_at:
        _cache.pop(key, None)
        return None
    return value


def render_template(key: str, vars: dict) -> Optional[str]:
    """库优先渲染：模板存在且已发布则返回渲染文本，否则返回 None（调用方回退内置）。"""
    entry = _cache_get(key)
    if entry is None:
        value = _load_available(key)
        # 负缓存：value 为 None 也缓存，避免频繁打库
        _cache[key] = (time.time() + CACHE_TTL, value)
        entry = value
    if entry is None:
        return None
    return _render(entry["content"], vars)


def render_default_template(key: str, vars: dict) -> str:
    """渲染内置默认模板（运行时兜底，与种子内容同源）。"""
    meta = prompt_defaults.DEFAULT_TEMPLATES.get(key)
    if meta is None:
        raise KeyError(f"无内置模板: {key}")
    return _render(meta["content"], vars)


def invalidate(key: str) -> None:
    """主动失效某模板缓存（管理侧写操作调用）。"""
    _invalidate_key(key)


# ---------- 启动种子 ----------

def ensure_seeded() -> int:
    """空模板写入全部内置默认模板（各带 v1 已发布）。返回写入条数（幂等）。"""
    created = 0
    with SessionLocal() as db:
        for key, meta in prompt_defaults.DEFAULT_TEMPLATES.items():
            exists = db.query(PromptTemplate).filter(PromptTemplate.key == key).first()
            if exists:
                continue
            row = PromptTemplate(
                id=str(uuid.uuid4()),
                key=key,
                name=meta["name"],
                category=meta["category"],
                description=meta.get("description"),
                is_active=True,
            )
            db.add(row)
            db.commit()
            db.refresh(row)
            ver = PromptVersion(
                id=str(uuid.uuid4()),
                template_id=row.id,
                version=1,
                content=meta["content"],
                change_note="内置默认版本",
                is_published=True,
            )
            db.add(ver)
            db.commit()
            created += 1
        if created:
            _cache.clear()
            logger.info("Prompt Library 种子写入 %d 个模板", created)
    return created
