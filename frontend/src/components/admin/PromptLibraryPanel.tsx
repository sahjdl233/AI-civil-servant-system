"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { usePrompts } from "../../hooks/usePrompts";
import Card from "../ui/Card";
import Badge from "../ui/Badge";
import Button from "../ui/Button";
import {
  AlertIcon,
  CheckIcon,
  LoaderIcon,
  PlusIcon,
  SearchIcon,
  TrashIcon,
  XIcon,
} from "../ui/icons";
import PromptDiff from "../PromptDiff";
import type {
  DiffResult,
  PromptTemplate,
  PromptVersion,
} from "../../types/prompt";

const CATEGORY_LABELS: Record<string, string> = {
  detection: "题型识别",
  diagnosis: "题型诊断",
  evaluation: "整体评价",
  grader: "阅卷官",
  coach: "Coach",
  standard_answer: "标准答案",
  consensus: "Consensus",
  knowledge: "知识库",
};

const CATEGORY_ORDER = [
  "diagnosis",
  "coach",
  "grader",
  "consensus",
  "evaluation",
  "standard_answer",
  "detection",
  "knowledge",
];

const VARIABLES: { name: string; label: string }[] = [
  { name: "question_type", label: "题型" },
  { name: "question", label: "题目材料与题干" },
  { name: "answer", label: "学生作答" },
  { name: "essay_content", label: "学生作答（别名）" },
  { name: "dimensions", label: "维度 JSON（代码生成）" },
  { name: "methodology_description", label: "四步法描述（代码生成）" },
  { name: "chapter_content", label: "核心秘籍章节" },
  { name: "diagnosis_result", label: "阶段一诊断结果" },
  { name: "model_results", label: "多模型结果（Consensus）" },
  { name: "aggregate", label: "统计汇总（Consensus）" },
  { name: "knowledge_base", label: "知识库全文" },
];

interface CreateForm {
  key: string;
  name: string;
  category: string;
  description: string;
  content: string;
}

export default function PromptLibraryPanel() {
  const {
    items,
    loading,
    reload,
    getTemplate,
    createTemplate,
    deleteTemplate,
    listVersions,
    saveVersion,
    publishVersion,
    resetBuiltin,
    preview,
    diff,
  } = usePrompts();

  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<PromptTemplate | null>(null);
  const [versions, setVersions] = useState<PromptVersion[]>([]);
  const [dirty, setDirty] = useState(false);

  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [content, setContent] = useState("");
  const [changeNote, setChangeNote] = useState("");

  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState<string | null>(null);
  const [panelError, setPanelError] = useState<string | null>(null);

  const [previewText, setPreviewText] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [diffView, setDiffView] = useState<{ a: number; b: number; data: DiffResult } | null>(null);
  const [diffLoading, setDiffLoading] = useState(false);

  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState<CreateForm>({
    key: "",
    name: "",
    category: "diagnosis",
    description: "",
    content: "",
  });
  const [createSaving, setCreateSaving] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const selectTemplate = useCallback(
    async (id: string) => {
      setSelectedId(id);
      setDetailLoading(true);
      setPanelError(null);
      try {
        const tpl = await getTemplate(id);
        setDetail(tpl);
        setName(tpl.name);
        setCategory(tpl.category);
        setDescription(tpl.description ?? "");
        setContent(tpl.draft_content ?? tpl.content ?? "");
        setChangeNote("");
        setDirty(false);
        const v = await listVersions(id);
        setVersions(v.items);
      } catch (e) {
        setPanelError(e instanceof Error ? e.message : "加载模板失败");
      } finally {
        setDetailLoading(false);
      }
    },
    [getTemplate, listVersions]
  );

  const doSave = async (publish: boolean) => {
    if (!detail) return;
    if (!content.trim()) {
      setPanelError("内容不能为空");
      return;
    }
    if (!changeNote.trim()) {
      setPanelError("请填写变更说明");
      return;
    }
    setSaving(true);
    setPanelError(null);
    try {
      await saveVersion(detail.id, { content, change_note: changeNote, publish });
      await selectTemplate(detail.id);
      await reload();
      setDirty(false);
    } catch (e) {
      setPanelError(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  const doPublish = async (versionId: string) => {
    if (!detail) return;
    if (!confirm("确定将该版本设为生效？若该版本为历史版本，等同于回滚。")) return;
    setPublishing(versionId);
    setPanelError(null);
    try {
      await publishVersion(detail.id, versionId);
      await selectTemplate(detail.id);
      await reload();
    } catch (e) {
      setPanelError(e instanceof Error ? e.message : "发布失败");
    } finally {
      setPublishing(null);
    }
  };

  const doReset = async () => {
    if (!detail) return;
    if (!confirm("确定重置为该模板的内置默认内容？将生成一个新版本。")) return;
    setSaving(true);
    setPanelError(null);
    try {
      await resetBuiltin(detail.id, { change_note: "重置为内置默认", publish: false });
      await selectTemplate(detail.id);
      await reload();
    } catch (e) {
      setPanelError(e instanceof Error ? e.message : "重置失败");
    } finally {
      setSaving(false);
    }
  };

  const doPreview = async () => {
    if (!detail) return;
    setPreviewLoading(true);
    setPanelError(null);
    try {
      const r = await preview(detail.id);
      setPreviewText(r.rendered);
    } catch (e) {
      setPanelError(e instanceof Error ? e.message : "预览失败");
    } finally {
      setPreviewLoading(false);
    }
  };

  const openDiff = async (a: number, b: number) => {
    if (!detail) return;
    setDiffLoading(true);
    setPanelError(null);
    try {
      const data = await diff(detail.id, a, b);
      setDiffView({ a, b, data });
    } catch (e) {
      setPanelError(e instanceof Error ? e.message : "对比失败");
    } finally {
      setDiffLoading(false);
    }
  };

  const doDelete = async (tpl: PromptTemplate) => {
    if (!confirm(`确定删除模板「${tpl.name}」？将同时删除全部历史版本。`)) return;
    setPanelError(null);
    try {
      await deleteTemplate(tpl.id);
      if (selectedId === tpl.id) {
        setSelectedId(null);
        setDetail(null);
        setVersions([]);
      }
      await reload();
    } catch (e) {
      setPanelError(e instanceof Error ? e.message : "删除失败");
    }
  };

  const doCreate = async () => {
    if (!createForm.key.trim() || !createForm.name.trim() || !createForm.content.trim()) {
      setPanelError("请填写 key、名称与内容");
      return;
    }
    setCreateSaving(true);
    setPanelError(null);
    try {
      const created = await createTemplate({
        ...createForm,
        change_note: "初始版本",
        publish: true,
      });
      setShowCreate(false);
      setCreateForm({ key: "", name: "", category: "diagnosis", description: "", content: "" });
      await reload();
      await selectTemplate(created.id);
    } catch (e) {
      setPanelError(e instanceof Error ? e.message : "创建失败");
    } finally {
      setCreateSaving(false);
    }
  };

  const insertVariable = (v: string) => {
    const el = textareaRef.current;
    const token = `{{${v}}}`;
    if (!el) {
      setContent((c) => c + token);
      setDirty(true);
      return;
    }
    const start = el.selectionStart ?? content.length;
    const end = el.selectionEnd ?? content.length;
    const next = content.slice(0, start) + token + content.slice(end);
    setContent(next);
    setDirty(true);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + token.length, start + token.length);
    });
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter(
      (t) =>
        !q ||
        t.name.toLowerCase().includes(q) ||
        t.key.toLowerCase().includes(q) ||
        (t.description ?? "").toLowerCase().includes(q)
    );
  }, [items, search]);

  const grouped = useMemo(() => {
    const map = new Map<string, PromptTemplate[]>();
    for (const t of filtered) {
      if (!map.has(t.category)) map.set(t.category, []);
      map.get(t.category)!.push(t);
    }
    return [...map.entries()].sort((x, y) => {
      const xi = CATEGORY_ORDER.indexOf(x[0]);
      const yi = CATEGORY_ORDER.indexOf(y[0]);
      return (xi === -1 ? 99 : xi) - (yi === -1 ? 99 : yi);
    });
  }, [filtered]);

  const publishedVersion = detail?.published_version ?? null;

  return (
    <div className="space-y-4">
      {panelError && (
        <div className="p-4 rounded-xl bg-danger/10 text-danger border border-danger/20 flex items-center">
          <AlertIcon className="w-5 h-5 mr-2 flex-shrink-0" />
          {panelError}
        </div>
      )}

      <Card>
        <div className="p-4 border-b border-border flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h2 className="font-serif text-lg font-semibold text-ink">Prompt 库</h2>
            <Badge>{items.length} 个模板</Badge>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <SearchIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink-tertiary" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="搜索名称 / key / 描述"
                className="w-56 h-10 pl-9 pr-3 text-sm bg-surface border border-border rounded-lg focus:border-accent focus:ring-2 focus:ring-accent/15 outline-none text-ink placeholder:text-ink-tertiary"
              />
            </div>
            <Button size="md" onClick={() => setShowCreate(true)}>
              <PlusIcon className="w-4 h-4" />
              新增模板
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-sm text-ink-tertiary">
            <LoaderIcon className="animate-spin w-4 h-4 mr-2" />
            加载中...
          </div>
        ) : items.length === 0 ? (
          <div className="py-16 text-center text-ink-tertiary">
            暂无模板，点击右上角「新增模板」开始创建
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr]">
            {/* 左栏：模板列表（按分类分组） */}
            <div className="border-b lg:border-b-0 lg:border-r border-border max-h-[640px] overflow-y-auto">
              {grouped.map(([cat, list]) => (
                <div key={cat} className="py-2 px-3">
                  <div className="px-2 py-1.5 text-xs font-medium text-ink-tertiary">
                    {CATEGORY_LABELS[cat] ?? cat}
                  </div>
                  <div className="space-y-0.5">
                    {list.map((t) => {
                      const active = selectedId === t.id;
                      return (
                        <div
                          key={t.id}
                          onClick={() => selectTemplate(t.id)}
                          className={`group rounded-lg px-3 py-2.5 cursor-pointer transition-colors ${
                            active ? "bg-accent-soft text-accent" : "hover:bg-surface-muted"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className={`text-sm font-medium truncate ${active ? "text-accent" : "text-ink"}`}>
                              {t.name}
                            </span>
                            {!t.is_active && (
                              <Badge className="bg-surface-muted text-ink-tertiary">停用</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="font-mono text-[11px] text-ink-tertiary truncate">
                              {t.key}
                            </span>
                            <span className="ml-auto flex items-center gap-1.5">
                              {t.published_version != null ? (
                                <Badge className="bg-success/10 text-success">v{t.published_version}</Badge>
                              ) : (
                                <Badge className="bg-surface-muted text-ink-tertiary">内置生效</Badge>
                              )}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  doDelete(t);
                                }}
                                className="hidden group-hover:inline-flex p-1 text-ink-tertiary hover:text-danger transition-colors"
                                title="删除模板"
                              >
                                <TrashIcon className="w-3.5 h-3.5" />
                              </button>
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* 右栏：编辑器 + 版本历史 */}
            <div className="p-5">
              {detailLoading ? (
                <div className="flex items-center justify-center py-24 text-sm text-ink-tertiary">
                  <LoaderIcon className="animate-spin w-4 h-4 mr-2" />
                  加载中...
                </div>
              ) : !detail ? (
                <div className="py-24 text-center text-ink-tertiary">
                  从左侧选择一个模板进行编辑
                </div>
              ) : (
                <div className="space-y-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-ink mb-1.5">名称</label>
                      <input
                        value={name}
                        onChange={(e) => {
                          setName(e.target.value);
                          setDirty(true);
                        }}
                        className="w-full h-10 px-3 text-sm bg-surface border border-border rounded-lg focus:border-accent focus:ring-2 focus:ring-accent/15 outline-none text-ink"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-ink mb-1.5">分类</label>
                      <select
                        value={category}
                        onChange={(e) => {
                          setCategory(e.target.value);
                          setDirty(true);
                        }}
                        className="w-full h-10 px-3 text-sm bg-surface border border-border rounded-lg focus:border-accent focus:ring-2 focus:ring-accent/15 outline-none text-ink"
                      >
                        {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                          <option key={k} value={k}>
                            {v}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-ink-tertiary font-mono">
                    key:
                    <span className="text-accent">{detail.key}</span>
                    <Badge className="bg-success/10 text-success">
                      {publishedVersion != null ? `生效版本 v${publishedVersion}` : "内置生效"}
                    </Badge>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-ink mb-1.5">描述</label>
                    <input
                      value={description}
                      onChange={(e) => {
                        setDescription(e.target.value);
                        setDirty(true);
                      }}
                      className="w-full h-10 px-3 text-sm bg-surface border border-border rounded-lg focus:border-accent focus:ring-2 focus:ring-accent/15 outline-none text-ink"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-ink mb-2">
                      内容（支持 {"{{变量}}"} 占位符）
                    </label>
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {VARIABLES.map((v) => (
                        <button
                          key={v.name}
                          onClick={() => insertVariable(v.name)}
                          className="px-2 py-1 text-[11px] font-mono bg-surface-muted border border-border rounded-md text-ink-secondary hover:text-accent hover:border-accent transition-colors"
                          title={v.label}
                        >
                          {`{{${v.name}}}`}
                        </button>
                      ))}
                    </div>
                    <textarea
                      ref={textareaRef}
                      value={content}
                      onChange={(e) => {
                        setContent(e.target.value);
                        setDirty(true);
                      }}
                      spellCheck={false}
                      className="w-full min-h-[320px] p-4 text-[13px] leading-relaxed font-mono bg-surface border border-border rounded-lg focus:border-accent focus:ring-2 focus:ring-accent/15 outline-none text-ink whitespace-pre"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-end">
                    <div>
                      <label className="block text-sm font-medium text-ink mb-1.5">变更说明（必填）</label>
                      <input
                        value={changeNote}
                        onChange={(e) => setChangeNote(e.target.value)}
                        placeholder="本次修改的内容概述"
                        className="w-full h-10 px-3 text-sm bg-surface border border-border rounded-lg focus:border-accent focus:ring-2 focus:ring-accent/15 outline-none text-ink placeholder:text-ink-tertiary"
                      />
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button variant="secondary" size="md" onClick={doPreview} disabled={previewLoading || saving}>
                        {previewLoading ? <LoaderIcon className="w-4 h-4 animate-spin" /> : null}
                        预览
                      </Button>
                      <Button variant="secondary" size="md" onClick={doReset} disabled={saving}>
                        重置内置
                      </Button>
                      <Button variant="secondary" size="md" onClick={() => doSave(false)} disabled={saving || !dirty}>
                        {saving ? <LoaderIcon className="w-4 h-4 animate-spin" /> : null}
                        保存草稿
                      </Button>
                      <Button size="md" onClick={() => doSave(true)} disabled={saving || !dirty}>
                        {saving ? <LoaderIcon className="w-4 h-4 animate-spin" /> : <CheckIcon className="w-4 h-4" />}
                        保存并发布
                      </Button>
                    </div>
                  </div>

                  <div className="border-t border-border pt-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-medium text-ink">版本历史</h3>
                      <span className="text-xs text-ink-tertiary">发布任意历史版本即回滚</span>
                    </div>
                    {versions.length === 0 ? (
                      <div className="py-6 text-center text-ink-tertiary text-sm">暂无版本</div>
                    ) : (
                      <div className="space-y-2">
                        {versions.map((v) => (
                          <div
                            key={v.id}
                            className={`flex flex-wrap items-center gap-2 px-3 py-2.5 rounded-lg border ${
                              v.is_published
                                ? "border-accent/30 bg-accent-soft/40"
                                : "border-border bg-surface-muted/40"
                            }`}
                          >
                            <Badge className={v.is_published ? "bg-accent text-white" : "bg-surface-muted text-ink-secondary"}>
                              v{v.version}
                            </Badge>
                            <span className="text-xs text-ink-tertiary font-mono">
                              {v.created_at ? new Date(v.created_at).toLocaleString() : ""}
                            </span>
                            <span className="text-sm text-ink-secondary flex-1 min-w-0 truncate">
                              {v.change_note || ""}
                            </span>
                            <div className="flex items-center gap-1.5">
                              {!v.is_published && (
                                <Button
                                  variant="secondary"
                                  size="md"
                                  className="!h-8 !px-2.5 !text-xs"
                                  onClick={() => doPublish(v.id)}
                                  disabled={publishing === v.id}
                                >
                                  {publishing === v.id ? <LoaderIcon className="w-3.5 h-3.5 animate-spin" /> : null}
                                  发布
                                </Button>
                              )}
                              {v.is_published && (
                                <Badge className="bg-accent text-white">当前生效</Badge>
                              )}
                              {publishedVersion != null && v.version !== publishedVersion && (
                                <Button
                                  variant="secondary"
                                  size="md"
                                  className="!h-8 !px-2.5 !text-xs"
                                  onClick={() => openDiff(publishedVersion, v.version)}
                                  disabled={diffLoading}
                                >
                                  对比
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </Card>

      {/* 新增模板弹窗 */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/40">
          <div className="bg-surface rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-border">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h3 className="font-serif text-lg font-semibold text-ink">新增模板</h3>
              <button
                onClick={() => setShowCreate(false)}
                className="p-1.5 text-ink-tertiary hover:text-ink rounded-md transition-colors"
                aria-label="关闭"
              >
                <XIcon className="w-5 h-5" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-ink mb-1.5">
                    key（创建后只读）
                  </label>
                  <input
                    value={createForm.key}
                    onChange={(e) => setCreateForm({ ...createForm, key: e.target.value })}
                    placeholder="如 grader_prompt"
                    className="w-full h-10 px-3 text-sm font-mono bg-surface border border-border rounded-lg focus:border-accent focus:ring-2 focus:ring-accent/15 outline-none text-ink placeholder:text-ink-tertiary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-ink mb-1.5">名称</label>
                  <input
                    value={createForm.name}
                    onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                    placeholder="如 概括题 Prompt"
                    className="w-full h-10 px-3 text-sm bg-surface border border-border rounded-lg focus:border-accent focus:ring-2 focus:ring-accent/15 outline-none text-ink placeholder:text-ink-tertiary"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-ink mb-1.5">分类</label>
                <select
                  value={createForm.category}
                  onChange={(e) => setCreateForm({ ...createForm, category: e.target.value })}
                  className="w-full h-10 px-3 text-sm bg-surface border border-border rounded-lg focus:border-accent focus:ring-2 focus:ring-accent/15 outline-none text-ink"
                >
                  {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-ink mb-1.5">描述</label>
                <input
                  value={createForm.description}
                  onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                  className="w-full h-10 px-3 text-sm bg-surface border border-border rounded-lg focus:border-accent focus:ring-2 focus:ring-accent/15 outline-none text-ink"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink mb-1.5">内容</label>
                <textarea
                  value={createForm.content}
                  onChange={(e) => setCreateForm({ ...createForm, content: e.target.value })}
                  spellCheck={false}
                  className="w-full min-h-[200px] p-4 text-[13px] leading-relaxed font-mono bg-surface border border-border rounded-lg focus:border-accent focus:ring-2 focus:ring-accent/15 outline-none text-ink whitespace-pre"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border">
              <Button variant="secondary" onClick={() => setShowCreate(false)}>
                取消
              </Button>
              <Button onClick={doCreate} disabled={createSaving}>
                {createSaving ? (
                  <>
                    <LoaderIcon className="w-4 h-4 animate-spin" />
                    创建中...
                  </>
                ) : (
                  "创建"
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 预览弹窗 */}
      {previewText != null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/40">
          <div className="bg-surface rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col border border-border">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h3 className="font-serif text-lg font-semibold text-ink">渲染预览</h3>
              <button
                onClick={() => setPreviewText(null)}
                className="p-1.5 text-ink-tertiary hover:text-ink rounded-md transition-colors"
                aria-label="关闭"
              >
                <XIcon className="w-5 h-5" />
              </button>
            </div>
            <pre className="flex-1 overflow-auto p-6 text-[13px] leading-relaxed font-mono text-ink whitespace-pre-wrap">
              {previewText}
            </pre>
          </div>
        </div>
      )}

      {/* 版本对比弹窗 */}
      {diffView && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/40">
          <div className="bg-surface rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col border border-border">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h3 className="font-serif text-lg font-semibold text-ink">
                版本对比
              </h3>
              <button
                onClick={() => setDiffView(null)}
                className="p-1.5 text-ink-tertiary hover:text-ink rounded-md transition-colors"
                aria-label="关闭"
              >
                <XIcon className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-6">
              {diffLoading ? (
                <div className="flex items-center justify-center py-16 text-sm text-ink-tertiary">
                  <LoaderIcon className="animate-spin w-4 h-4 mr-2" />
                  对比中...
                </div>
              ) : (
                <PromptDiff
                  ops={diffView.data.ops}
                  aLabel={`v${diffView.a}`}
                  bLabel={`v${diffView.b}`}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
