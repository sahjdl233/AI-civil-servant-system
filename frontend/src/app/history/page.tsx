"use client";

import { useEffect, useMemo, useState } from "react";
import { API_BASE_URL } from "../../config/api";
import Navigation from "../../components/Navigation";
import Card from "../../components/ui/Card";
import Badge from "../../components/ui/Badge";
import ScoreBar from "../../components/ui/ScoreBar";
import PageHeader from "../../components/ui/PageHeader";
import Button from "../../components/ui/Button";
import {
  AlertIcon,
  ArrowRightIcon,
  CheckIcon,
  FileTextIcon,
  HistoryIcon,
  LoaderIcon,
  SearchIcon,
  TrashIcon,
} from "../../components/ui/icons";

type HistoryItem = {
  id: string;
  timestamp?: string;
  type?: string;
  questionType?: string;
  score?: number;
};

type HistoryDetail = {
  id: string;
  timestamp?: string;
  type?: string;
  request: Record<string, unknown>;
  response: Record<string, unknown>;
  extra?: Record<string, unknown>;
};

const api = () => API_BASE_URL;

export default function HistoryPage() {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<HistoryDetail | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showRaw, setShowRaw] = useState(false);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [qtypeFilter, setQtypeFilter] = useState<string>("all");

  // Sanitize AI outputs to hide internal/system prompt phrases
  const sanitizeText = (text: string) => {
    if (!text) return text;
    try {
      let t = text;
      const patterns: RegExp[] = [
        /as an ai (language )?model[,\s]?/gi,
        /i cannot (?:assist|comply).*?\.?\s*/gi,
        /openai.*?guidelines:?\s*/gi,
        /system prompt:?\s*/gi,
        /internal instructions:?\s*/gi,
        /作为[\S\s]{0,4}AI[\S\s]{0,4}模型[，,]*/g,
        /系统提示[：:]\s*/g,
        /内部指令[：:]\s*/g,
      ];
      for (const p of patterns) t = t.replace(p, "");
      return t.trimStart();
    } catch {
      return text;
    }
  };

  // Replacer for JSON.stringify to sanitize all string fields
  const jsonSanitizer = (_key: string, value: unknown) =>
    typeof value === "string" ? sanitizeText(value) : value;

  const loadList = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${api()}/api/v1/essays/history?limit=50`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setItems(data.items || []);
    } catch (e: unknown) {
      const error = e as Error;
      setError(error?.message || "加载失败");
    } finally {
      setLoading(false);
    }
  };

  const loadDetail = async (id: string) => {
    setError(null);
    setSelected(null);
    try {
      const res = await fetch(`${api()}/api/v1/essays/history/${id}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setSelected(data as HistoryDetail);
    } catch (e: unknown) {
      const error = e as Error;
      setError(error?.message || "获取详情失败");
    }
  };

  const clearAll = async () => {
    if (!confirm("确定清空所有历史记录？该操作不可恢复")) return;
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`${api()}/api/v1/essays/history`, { method: "DELETE" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSelected(null);
      await loadList();
    } catch (e: unknown) {
      const error = e as Error;
      setError(error?.message || "操作失败");
    } finally {
      setDeleting(false);
    }
  };

  useEffect(() => {
    loadList();
  }, []);

  // Helpers for structured rendering
  const normalizeDetails = (details: unknown): Array<{
    item: string;
    fullScore: number;
    actualScore: number;
    description: string;
  }> | undefined => {
    if (!details) return undefined;
    const rec = details as Record<string, unknown>;
    const arr = Array.isArray(details)
      ? details
      : Array.isArray(rec?.data)
      ? rec.data
      : Array.isArray(rec?.items)
      ? rec.items
      : Array.isArray(rec?.scoreDetails)
      ? rec.scoreDetails
      : Array.isArray(rec?.score_details)
      ? rec.score_details
      : undefined;
    if (!arr) return undefined;
    const toNumber = (v: unknown, def = 0) => {
      const n = typeof v === "number" ? v : parseFloat(String(v));
      return Number.isFinite(n) ? n : def;
    };
    const mapped = (arr as unknown[])
      .map((d) => {
        const o = (d as Record<string, unknown>) || {};
        return {
          item: String(o.item ?? o.name ?? o.title ?? ""),
          fullScore: toNumber(o.fullScore ?? o.full_score ?? o.full ?? o.max ?? 100, 100),
          actualScore: toNumber(o.actualScore ?? o.actual_score ?? o.score ?? o.value ?? 0, 0),
          description: String(o.description ?? o.desc ?? o.detail ?? ""),
        };
      })
      .filter((x) => x.item);
    return mapped.length ? mapped : undefined;
  };

  const scoreDetails = selected ? normalizeDetails(selected?.response?.scoreDetails) : undefined;
  const totalFullScore = scoreDetails?.reduce((s, d) => s + (d.fullScore || 0), 0) ?? 0;
  const displayScale = totalFullScore > 0 && Math.abs(totalFullScore - 100) > 0.1 ? 100 / totalFullScore : 1;
  const niceDate = (iso?: string) => (iso ? new Date(iso).toLocaleString() : "");

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((it) => {
      const byType = typeFilter === "all" || (it.type || "").toLowerCase() === typeFilter;
      const byQType = qtypeFilter === "all" || (it.questionType || "").toLowerCase() === qtypeFilter;
      const byQuery =
        !q ||
        (it.type || "").toLowerCase().includes(q) ||
        (it.questionType || "").toLowerCase().includes(q) ||
        (it.id || "").toLowerCase().includes(q);
      return byType && byQType && byQuery;
    });
  }, [items, query, typeFilter, qtypeFilter]);

  const typeOptions = useMemo(
    () => Array.from(new Set(items.map((i) => (i.type || "").toLowerCase()).filter(Boolean))),
    [items]
  );
  const qtypeOptions = useMemo(
    () => Array.from(new Set(items.map((i) => (i.questionType || "").toLowerCase()).filter(Boolean))),
    [items]
  );

  const copyJSON = async (obj: unknown) => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(obj, jsonSanitizer, 2));
      alert("已复制到剪贴板");
    } catch {
      alert("复制失败");
    }
  };

  return (
    <div className="min-h-screen bg-canvas pb-16 lg:pb-0 lg:pl-60">
      <Navigation />

      <div className="mx-auto max-w-6xl px-4 py-8">
        <PageHeader
          title="历史记录"
          description="查看您的申论批改历史，回顾学习轨迹"
          actions={
            <>
              <Button variant="ghost" href="/">
                <ArrowRightIcon className="w-4 h-4 rotate-180" />
                返回首页
              </Button>
              <Button variant="ghost" onClick={loadList} disabled={loading}>
                {loading ? (
                  <LoaderIcon className="w-4 h-4 animate-spin" />
                ) : (
                  <HistoryIcon className="w-4 h-4" />
                )}
                刷新
              </Button>
              <button
                onClick={clearAll}
                disabled={deleting}
                className="inline-flex items-center gap-2 h-10 px-5 text-sm font-medium rounded-lg text-danger bg-surface border border-border hover:bg-danger/10 disabled:opacity-40 transition-colors"
              >
                <TrashIcon className="w-4 h-4" />
                {deleting ? "清空中..." : "清空全部"}
              </button>
            </>
          }
        />

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-danger/10 text-danger border border-danger/20">
            <div className="flex items-center">
              <AlertIcon className="w-5 h-5 mr-2 flex-shrink-0" />
              {error}
            </div>
          </div>
        )}

        {/* 搜索和筛选区域 - 独立全宽卡片 */}
        <Card className="mb-6 p-6">
          <div className="flex flex-wrap gap-6 items-center">
            <div className="flex-1 min-w-80">
              <div className="relative">
                <SearchIcon className="absolute left-3.5 top-1/2 transform -translate-y-1/2 w-5 h-5 text-ink-tertiary" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="搜索 ID、类型或题型..."
                  className="w-full pl-11 pr-4 h-10 text-base bg-surface border border-border rounded-lg focus:border-accent focus:ring-2 focus:ring-accent/15 outline-none text-ink placeholder:text-ink-tertiary transition-colors"
                />
              </div>
            </div>
            <div className="flex items-center gap-6 flex-wrap">
              <div className="flex items-center gap-3">
                <label className="text-sm font-medium text-ink-secondary">类型</label>
                <select
                  className="h-10 px-3 text-base bg-surface border border-border rounded-lg focus:border-accent focus:ring-2 focus:ring-accent/15 outline-none text-ink transition-colors"
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                >
                  <option value="all">全部</option>
                  {typeOptions.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-3">
                <label className="text-sm font-medium text-ink-secondary">题型</label>
                <select
                  className="h-10 px-3 text-base bg-surface border border-border rounded-lg focus:border-accent focus:ring-2 focus:ring-accent/15 outline-none text-ink transition-colors"
                  value={qtypeFilter}
                  onChange={(e) => setQtypeFilter(e.target.value)}
                >
                  <option value="all">全部</option>
                  {qtypeOptions.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div className="text-base text-ink-secondary bg-surface-muted px-4 py-2 rounded-lg border border-border">
                共 <span className="font-serif font-semibold text-accent">{filteredItems.length}</span> 条记录
              </div>
            </div>
          </div>
        </Card>

        {/* 左右分栏布局 - 各自独立的卡片 */}
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_2fr] gap-6">
          {/* 左栏：历史记录列表 */}
          <Card>
            <div className="p-6 border-b border-border">
              <div className="flex items-center justify-between">
                <h2 className="font-serif text-xl font-semibold text-ink flex items-center gap-2.5">
                  <span className="w-2 h-2 rounded-full bg-accent"></span>
                  最近记录
                </h2>
                {loading && (
                  <div className="flex items-center text-sm text-ink-tertiary">
                    <LoaderIcon className="animate-spin w-4 h-4 mr-2" />
                    加载中...
                  </div>
                )}
              </div>
            </div>

            <div className="p-6 max-h-[800px] overflow-y-auto">

              {/* 加载状态 */}
              {loading && items.length === 0 && (
                <div className="space-y-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={`loading-${i}`} className="animate-pulse">
                      <div className="bg-surface-muted rounded-xl p-5 border border-border">
                        <div className="flex items-center">
                          <div className="w-1.5 h-16 bg-border rounded-full mr-4"></div>
                          <div className="flex-1">
                            <div className="flex justify-between items-start mb-3">
                              <div className="space-y-2">
                                <div className="h-4 w-24 bg-border rounded"></div>
                                <div className="h-3 w-32 bg-border rounded"></div>
                              </div>
                              <div className="h-8 w-16 bg-border rounded-lg"></div>
                            </div>
                            <div className="flex gap-2">
                              <div className="h-6 w-20 bg-border rounded-full"></div>
                              <div className="h-6 w-20 bg-border rounded-full"></div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* 记录列表 */}
              {!loading || items.length > 0 ? (
                <div className="space-y-2">
                  {filteredItems.map((it) => {
                    const ts = it.timestamp ? new Date(it.timestamp) : null;
                    const tsStr = ts ? ts.toLocaleString() : "";
                    const score = typeof it.score === "number" ? it.score : null;
                    const isSelected = selected && selected.id === it.id;

                    // 根据分数确定颜色
                    const getScoreColor = () => {
                      if (score === null) return "bg-border";
                      if (score >= 80) return "bg-success";
                      if (score >= 60) return "bg-warning";
                      return "bg-danger";
                    };

                    const getScoreTextColor = () => {
                      if (score === null) return "text-ink-tertiary";
                      if (score >= 80) return "text-success";
                      if (score >= 60) return "text-warning";
                      return "text-danger";
                    };

                    return (
                      <div
                        key={it.id}
                        className={`group cursor-pointer rounded-xl border transition-colors duration-200 ${
                          isSelected
                            ? "border-accent bg-accent-soft"
                            : "border-border bg-surface hover:bg-surface-muted"
                        }`}
                        onClick={() => loadDetail(it.id)}
                      >
                        <div className="flex items-center p-4">
                          {/* 彩色指示点 */}
                          <div className={`w-2.5 h-2.5 ${getScoreColor()} rounded-full mr-4 flex-shrink-0`}></div>

                          {/* 主要信息 */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <div className="text-sm text-ink-tertiary truncate">
                                {tsStr || "未知时间"}
                              </div>
                              {score !== null && (
                                <div className={`text-sm font-semibold font-serif ${getScoreTextColor()}`}>
                                  {score.toFixed(1)}分
                                </div>
                              )}
                            </div>

                            <div className="flex items-center gap-2 mb-2">
                              {it.type && (
                                <Badge className="bg-accent-soft text-accent">{it.type}</Badge>
                              )}
                              {it.questionType && (
                                <Badge>{it.questionType}</Badge>
                              )}
                            </div>

                            <div className="text-xs text-ink-tertiary font-mono truncate">
                              {it.id.substring(0, 16)}...
                            </div>
                          </div>

                          {/* 选中状态指示 */}
                          {isSelected && (
                            <div className="ml-3 w-2 h-2 bg-accent rounded-full flex-shrink-0"></div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : null}

              {/* 空状态 */}
              {filteredItems.length === 0 && !loading && (
                <div className="text-center py-20">
                  <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-surface-muted flex items-center justify-center">
                    <FileTextIcon className="w-9 h-9 text-ink-tertiary" />
                  </div>
                  <div className="text-lg font-semibold text-ink mb-2">暂无历史记录</div>
                  <div className="text-base text-ink-secondary">开始您的第一次申论批改吧</div>
                </div>
              )}
            </div>
          </Card>

          {/* 右栏：详情视图 */}
          <Card>
            {!selected ? (
              <div className="h-[900px] flex items-center justify-center p-8">
                <div className="text-center">
                  <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-surface-muted flex items-center justify-center">
                    <FileTextIcon className="w-11 h-11 text-ink-tertiary" />
                  </div>
                  <div className="text-xl font-serif font-semibold text-ink mb-3">请选择记录查看详情</div>
                  <div className="text-base text-ink-secondary">点击左侧列表中的任意记录</div>
                </div>
              </div>
            ) : (
              <>
                <div className="p-6 border-b border-border">
                  <div className="flex items-center justify-between mb-5">
                    <h2 className="font-serif text-xl font-semibold text-ink flex items-center gap-2.5">
                      <span className="w-2 h-2 rounded-full bg-accent"></span>
                      详情信息
                    </h2>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-sm text-ink-secondary bg-surface-muted px-3 py-2 rounded-lg border border-border font-mono">
                      ID: {selected.id.substring(0, 20)}...
                    </span>
                    <Button
                      variant={showRaw ? "primary" : "secondary"}
                      size="md"
                      onClick={() => setShowRaw((v) => !v)}
                    >
                      {showRaw ? "结构化视图" : "原始JSON"}
                    </Button>
                    {!showRaw && (
                      <Button
                        variant="secondary"
                        size="md"
                        onClick={() => copyJSON(selected?.response ?? selected)}
                      >
                        复制数据
                      </Button>
                    )}
                  </div>
                </div>

                <div className="p-6 max-h-[800px] overflow-y-auto">
                  {showRaw ? (
                    <div className="space-y-6">
                      <div>
                        <div className="text-base font-semibold text-ink mb-3 flex items-center">
                          <ArrowRightIcon className="w-5 h-5 mr-2.5 text-accent" />
                          请求数据
                        </div>
                        <pre className="text-xs bg-surface-muted text-ink-secondary p-4 rounded-xl overflow-auto border border-border max-h-40 font-mono">
                          {JSON.stringify(selected.request, jsonSanitizer, 2)}
                        </pre>
                      </div>
                      <div>
                        <div className="text-base font-semibold text-ink mb-3 flex items-center">
                          <CheckIcon className="w-5 h-5 mr-2.5 text-success" />
                          响应数据
                        </div>
                        <pre className="text-xs bg-surface-muted text-ink-secondary p-4 rounded-xl overflow-auto border border-border max-h-48 font-mono">
                          {JSON.stringify(selected.response, jsonSanitizer, 2)}
                        </pre>
                      </div>
                      {selected.extra && (
                        <div>
                          <div className="text-base font-semibold text-ink mb-3 flex items-center">
                            <AlertIcon className="w-5 h-5 mr-2.5 text-warning" />
                            额外信息
                          </div>
                          <pre className="text-xs bg-surface-muted text-ink-secondary p-4 rounded-xl overflow-auto border border-border max-h-40 font-mono">
                            {JSON.stringify(selected.extra, jsonSanitizer, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {/* 概要信息 */}
                      <div className="bg-surface-muted rounded-xl p-6 border border-border">
                        <div className="flex items-center mb-5">
                          <HistoryIcon className="w-5 h-5 mr-2.5 text-accent" />
                          <span className="font-serif text-lg font-semibold text-ink">基本信息</span>
                        </div>
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-ink-tertiary font-medium">提交时间</span>
                            <span className="text-sm text-ink font-medium">{niceDate(selected.timestamp)}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-ink-tertiary font-medium">类型</span>
                            <span className="px-3 py-1.5 rounded-full bg-accent-soft text-accent border border-accent/20 text-sm font-medium">
                              {selected.type}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-ink-tertiary font-medium">题型</span>
                            <span className="px-3 py-1.5 rounded-full bg-surface-muted text-ink-secondary border border-border text-sm font-medium">
                              {String((selected?.response as Record<string, unknown>)?.questionType) || String((selected?.request as Record<string, unknown>)?.question_type) || "未识别"}
                            </span>
                          </div>
                          {typeof (selected?.response as Record<string, unknown>)?.score === "number" && (
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-ink-tertiary font-medium">总分</span>
                              <div className="flex items-baseline">
                                <span className={`font-serif text-3xl font-semibold ${
                                  Number((selected?.response as Record<string, unknown>)?.score) >= 80
                                    ? "text-success"
                                    : Number((selected?.response as Record<string, unknown>)?.score) >= 60
                                    ? "text-warning"
                                    : "text-danger"
                                }`}>
                                  {Number((selected?.response as Record<string, unknown>)?.score).toFixed(1)}
                                </span>
                                <span className="text-sm text-ink-tertiary ml-1.5">分</span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* 评分明细 */}
                      {scoreDetails && scoreDetails.length > 0 ? (
                        <div className="bg-surface rounded-xl border border-border">
                          <div className="p-5 border-b border-border">
                            <h3 className="font-serif text-lg font-semibold text-ink flex items-center gap-2.5">
                              <CheckIcon className="w-5 h-5 text-accent" />
                              评分明细
                            </h3>
                          </div>
                          <div className="p-5 space-y-5">
                            {scoreDetails.map((d, idx) => {
                              const full = (d.fullScore || 0) * displayScale;
                              const pct = full > 0 ? Math.max(0, Math.min(100, (d.actualScore / full) * 100)) : 0;
                              const getScoreColor = () => {
                                if (pct >= 80) return "text-success";
                                if (pct >= 60) return "text-warning";
                                return "text-danger";
                              };

                              return (
                                <div key={idx} className="bg-surface-muted rounded-xl p-5 border border-border">
                                  <div className="flex justify-between items-center mb-3">
                                    <span className="text-base font-semibold text-ink">{d.item}</span>
                                    <div className="text-right">
                                      <span className={`font-serif text-lg font-bold ${getScoreColor()}`}>
                                        {d.actualScore}/{Number(full.toFixed(1))}
                                      </span>
                                    </div>
                                  </div>
                                  <ScoreBar
                                    value={pct}
                                    tone={pct >= 80 ? "success" : pct >= 60 ? "warning" : "danger"}
                                    className="h-2.5"
                                    trackClassName="mb-4"
                                  />
                                  <div className="text-sm text-ink leading-relaxed">
                                    <div
                                      style={{
                                        lineHeight: '1.6',
                                      }}
                                      dangerouslySetInnerHTML={{
                                        __html: sanitizeText(d.description)
                                          .replace(/\\n/g, '\n')  // 首先将字面量\n转换为真实换行符
                                          .replace(/\r\n/g, '\n')
                                          .replace(/\n\n+/g, '</p><p class="mb-2 mt-2">')
                                          .replace(/\n/g, "<br/>")
                                          .replace(/\*\*(.*?)\*\*/g, '<strong class="text-accent font-medium">$1</strong>')
                                          .replace(/^/, '<p class="mb-2">')
                                          .replace(/$/, '</p>')
                                      }}
                                    />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ) : null}

                      {/* 详细反馈 */}
                      {(selected?.response as Record<string, unknown>)?.feedback ? (
                        <div className="bg-surface rounded-xl border border-border">
                          <div className="p-5 border-b border-border">
                            <h3 className="font-serif text-lg font-semibold text-ink flex items-center gap-2.5">
                              <FileTextIcon className="w-5 h-5 text-accent" />
                              详细反馈
                            </h3>
                          </div>
                          <div className="p-5">
                            <div className="text-base text-ink leading-loose">
                              <div
                                className="space-y-4"
                                style={{
                                  lineHeight: '1.8',
                                }}
                                dangerouslySetInnerHTML={{
                                  __html: sanitizeText(String((selected?.response as Record<string, unknown>)?.feedback))
                                    .replace(/\\n/g, '\n')  // 首先将字面量\n转换为真实换行符
                                    .replace(/\r\n/g, '\n')
                                    .replace(/\n\n+/g, '</p><p class="mb-4 mt-4">')
                                    .replace(/\n/g, "<br/>")
                                    .replace(/\*\*(.*?)\*\*/g, '<strong class="text-accent font-semibold">$1</strong>')
                                    .replace(/^/, '<p class="mb-4">')
                                    .replace(/$/, '</p>')
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      ) : null}

                      {/* 改进建议 */}
                      {Array.isArray((selected?.response as Record<string, unknown>)?.suggestions) &&
                        ((selected?.response as Record<string, unknown>)?.suggestions as string[]).length > 0 ? (
                          <div className="bg-surface rounded-xl border border-border">
                            <div className="p-5 border-b border-border">
                              <h3 className="font-serif text-lg font-semibold text-ink flex items-center gap-2.5">
                                <AlertIcon className="w-5 h-5 text-accent" />
                                改进建议
                              </h3>
                            </div>
                            <div className="p-5">
                              <ul className="space-y-5">
                                {((selected?.response as Record<string, unknown>)?.suggestions as string[]).map((s: string, i: number) => (
                                  <li key={i} className="flex items-start">
                                    <div className="flex-shrink-0 w-7 h-7 bg-accent-soft text-accent rounded-full flex items-center justify-center mr-3">
                                      <span className="font-serif text-sm font-bold">{i + 1}</span>
                                    </div>
                                    <div className="flex-1">
                                      <div
                                        className="text-base text-ink leading-relaxed"
                                        style={{
                                          lineHeight: '1.7',
                                        }}
                                        dangerouslySetInnerHTML={{
                                          __html: sanitizeText(String(s))
                                            .replace(/\\n/g, '\n')  // 首先将字面量\n转换为真实换行符
                                            .replace(/\r\n/g, '\n')
                                            .replace(/\n\n+/g, '</p><p class="mb-3 mt-3">')
                                            .replace(/\n/g, '<br/>')
                                            .replace(/\*\*(.*?)\*\*/g, '<strong class="text-accent font-medium">$1</strong>')
                                            .replace(/^/, '<p class="mb-3">')
                                            .replace(/$/, '</p>')
                                        }}
                                      />
                                    </div>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        ) : null}
                    </div>
                  )}
                </div>
              </>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
