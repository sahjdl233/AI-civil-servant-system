"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import Navigation from "../../components/Navigation";
import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import ScoreBar from "../../components/ui/ScoreBar";
import PageHeader from "../../components/ui/PageHeader";
import ModelSelector from "../../components/ModelSelector";
import MultiResultView from "../../components/MultiResultView";
import DualRoleResultView from "../../components/DualRoleResultView";
import CredibilityResultView from "../../components/CredibilityResultView";
import { useGradeMulti } from "../../hooks/useGradeMulti";
import { useGradeDual } from "../../hooks/useGradeDual";
import { useGradeCredibility } from "../../hooks/useGradeCredibility";
import { useProviders } from "../../hooks/useProviders";
import {
  HistoryIcon,
  SparkleIcon,
  XIcon,
} from "../../components/ui/icons";

type GradeMode = "dual" | "multi" | "credibility";

const MODE_TABS: { key: GradeMode; label: string }[] = [
  { key: "dual", label: "双角色批改" },
  { key: "multi", label: "多模型阅卷" },
  { key: "credibility", label: "可信度检验" },
];

export default function EssayPage() {
  const [questionMaterial, setQuestionMaterial] = useState<string>("");
  const [myAnswer, setMyAnswer] = useState<string>("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [credibilityProviderId, setCredibilityProviderId] = useState<string | undefined>(undefined);
  const [mode, setMode] = useState<GradeMode>("dual");
  const [progress, setProgress] = useState<number>(0);
  const { providers, loading: providersLoading } = useProviders();
  const multi = useGradeMulti();
  const dual = useGradeDual();
  const credibility = useGradeCredibility();

  const streaming = mode === "dual" ? dual.state.isStreaming : mode === "multi" ? multi.state.isStreaming : credibility.state.isStreaming;
  const error = mode === "dual" ? dual.state.error : mode === "multi" ? multi.state.error : credibility.state.error;
  const statusText = mode === "dual" ? dual.state.statusText : mode === "multi" ? multi.state.statusText : credibility.state.statusText;

  // 默认勾选：默认 Provider 优先并附带全部启用的模型；用户改动后保持选择
  useEffect(() => {
    if (providersLoading || providers.length === 0) return;
    setSelectedIds((prev) => {
      if (prev.length > 0) return prev;
      const defaults = providers.filter((p) => p.is_default).map((p) => p.id);
      const base = defaults.length > 0 ? defaults : [];
      const enabled = providers.filter((p) => p.is_enabled).map((p) => p.id);
      const merged = Array.from(new Set([...base, ...enabled]));
      return merged.length > 0 ? merged : providers.map((p) => p.id);
    });
  }, [providers, providersLoading]);

  // 提交期间驱动本地进度条
  useEffect(() => {
    if (!streaming) {
      setProgress(error ? 0 : 0);
      return;
    }
    let current = 0;
    setProgress(0);
    const timer = setInterval(() => {
      const inc = current < 60 ? 3 : current < 85 ? 1.5 : current < 95 ? 0.5 : 0.2;
      current = Math.min(99, current + inc);
      setProgress(current);
    }, 200);
    return () => clearInterval(timer);
  }, [streaming, error]);

  const handleSubmit = async () => {
    if (!questionMaterial.trim()) {
      alert("请先填写题目材料或题干");
      return;
    }
    if (!myAnswer.trim()) {
      alert("请先填写你的作答");
      return;
    }
    if (mode === "multi" && selectedIds.length === 0) {
      alert("请至少选择一个阅卷模型");
      return;
    }

    const combinedContent = `【题目材料与题干】\n${questionMaterial}\n\n【我的作答】\n${myAnswer}`;
    if (mode === "dual") {
      await dual.grade(combinedContent);
    } else if (mode === "multi") {
      await multi.grade(combinedContent, selectedIds);
    } else {
      await credibility.grade(combinedContent, credibilityProviderId);
    }

    // 保存学习记录到 localStorage（仅多模型模式记录模型选择）
    if (mode === "multi") {
      try {
        const recordId = `essay_result_${Date.now()}`;
        const recordData = {
          multi: true,
          timestamp: new Date().toISOString(),
          content: myAnswer.substring(0, 200) + (myAnswer.length > 200 ? "..." : ""),
          questionMaterial:
            questionMaterial.substring(0, 200) + (questionMaterial.length > 200 ? "..." : ""),
        };
        localStorage.setItem(recordId, JSON.stringify(recordData));
      } catch {
        // ignore localStorage errors
      }
    }
  };

  return (
    <div className="min-h-screen bg-canvas pb-16 lg:pb-0 lg:pl-60">
      <Navigation />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <PageHeader
          title="申论智能批改"
          description="AI 专家级批改，支持双角色批改与多模型阅卷，个性化学习建议，助力公考申论高分突破。"
          actions={
            <Link
              href="/history"
              className="inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-surface border border-border text-ink-secondary hover:text-ink hover:bg-surface-muted transition-colors text-sm flex-shrink-0"
            >
              <HistoryIcon className="w-4 h-4" />
              批改历史
            </Link>
          }
        />

        <div className="grid grid-cols-1 xl:grid-cols-[2fr_3fr] gap-6 items-start">
          {/* 左栏：输入区域 */}
          <Card className="p-5 sm:p-6">
            <h2 className="text-lg font-medium text-ink mb-5">输入区域</h2>

            {/* 批改模式切换 */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-ink mb-2">批改模式</label>
              <div className="inline-flex rounded-lg border border-border bg-surface-muted p-1 gap-1">
                {MODE_TABS.map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setMode(t.key)}
                    disabled={streaming}
                    className={`h-9 px-4 rounded-md text-sm font-medium transition-colors ${
                      mode === t.key
                        ? "bg-accent text-white"
                        : "text-ink-secondary hover:text-ink"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 题目材料和问题输入区域 */}
            <div className="mb-6">
              <label htmlFor="questionMaterial" className="block text-sm font-medium text-ink mb-2">
                题目材料与问题
              </label>
              <div className="relative">
                <textarea
                  id="questionMaterial"
                  value={questionMaterial}
                  onChange={(e) => setQuestionMaterial(e.target.value)}
                  placeholder="在此粘贴或输入题目给定材料及具体问题要求..."
                  className="w-full min-h-[220px] p-3.5 pr-10 border border-border rounded-lg focus:border-accent focus:ring-2 focus:ring-accent/15 outline-none resize-y text-ink placeholder:text-ink-tertiary leading-relaxed text-sm bg-surface"
                />
                {questionMaterial && (
                  <button
                    onClick={() => setQuestionMaterial("")}
                    type="button"
                    aria-label="清空题目材料"
                    className="absolute top-2.5 right-2.5 p-1.5 text-ink-tertiary hover:text-ink hover:bg-surface-muted rounded-md transition-colors"
                  >
                    <XIcon className="w-4 h-4" />
                  </button>
                )}
              </div>
              <div className="text-right text-xs text-ink-tertiary mt-1.5">
                字数 {questionMaterial.length}
              </div>
            </div>

            {/* 我的答案输入区域 */}
            <div className="mb-6">
              <label htmlFor="myAnswer" className="block text-sm font-medium text-ink mb-2">
                我的作答
              </label>
              <div className="relative">
                <textarea
                  id="myAnswer"
                  value={myAnswer}
                  onChange={(e) => setMyAnswer(e.target.value)}
                  placeholder="在此输入您对上述问题的答题内容..."
                  className="w-full min-h-[220px] p-3.5 pr-10 border border-border rounded-lg focus:border-accent focus:ring-2 focus:ring-accent/15 outline-none resize-y text-ink placeholder:text-ink-tertiary leading-relaxed text-sm bg-surface"
                />
                {myAnswer && (
                  <button
                    onClick={() => setMyAnswer("")}
                    type="button"
                    aria-label="清空作答"
                    className="absolute top-2.5 right-2.5 p-1.5 text-ink-tertiary hover:text-ink hover:bg-surface-muted rounded-md transition-colors"
                  >
                    <XIcon className="w-4 h-4" />
                  </button>
                )}
              </div>
              <div className="text-right text-xs text-ink-tertiary mt-1.5">
                字数 {myAnswer.length}
              </div>
            </div>

            {/* 阅卷模型选择（多模型模式多选 / 可信度模式单选） */}
            {mode === "multi" && (
              <ModelSelector
                providers={providers}
                selected={selectedIds}
                onChange={setSelectedIds}
                disabled={streaming}
              />
            )}
            {mode === "credibility" && (
              <div className="mb-6">
                <label className="block text-sm font-medium text-ink mb-2">评分模型</label>
                <select
                  value={credibilityProviderId ?? ""}
                  onChange={(e) => setCredibilityProviderId(e.target.value || undefined)}
                  disabled={streaming}
                  className="w-full h-10 px-3 rounded-lg border border-border bg-surface text-sm text-ink focus:border-accent focus:ring-2 focus:ring-accent/15 outline-none disabled:opacity-60"
                >
                  <option value="">默认模型</option>
                  {providers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} · {p.model}
                      {p.is_default ? "（默认）" : ""}
                    </option>
                  ))}
                </select>
                <div className="mt-1.5 text-xs text-ink-tertiary">
                  同一篇作文将连续评分 3 次，根据分数一致性评估可信度
                </div>
              </div>
            )}

            {/* 进度条 */}
            {streaming && (
              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-ink-secondary">
                    {statusText || "AI 正在分析中..."}
                  </span>
                  <span className="text-sm font-medium text-ink">
                    {Math.min(100, Math.round(progress))}%
                  </span>
                </div>
                <ScoreBar value={progress} className="h-2" />
              </div>
            )}

            {/* 提交按钮：手机端吸底 */}
            <div className="sticky bottom-20 lg:static pt-1">
              {streaming ? (
                <Button
                  onClick={mode === "dual" ? dual.stop : mode === "multi" ? multi.stop : credibility.stop}
                  className="w-full"
                  size="lg"
                  variant="secondary"
                >
                  <XIcon className="w-4 h-4" />
                  停止批改
                </Button>
              ) : (
                <Button
                  onClick={handleSubmit}
                  disabled={
                    !questionMaterial.trim() ||
                    !myAnswer.trim() ||
                    (mode === "multi" && selectedIds.length === 0)
                  }
                  className="w-full"
                  size="lg"
                >
                  <SparkleIcon className="w-4 h-4" />
                  {mode === "dual" ? "开始双角色批改" : mode === "multi" ? "开始 AI 批改" : "开始可信度检验"}
                </Button>
              )}
            </div>
          </Card>

          {/* 右栏：结果展示区域 */}
          <div>
            {mode === "dual" && (
              dual.state.combined ? (
                <DualRoleResultView
                  combined={dual.state.combined}
                  questionType={dual.state.questionType}
                  questionTypeSource={dual.state.questionTypeSource}
                  isStreaming={dual.state.isStreaming}
                  standardAnswer={dual.standardAnswer}
                  onFetchStandardAnswer={dual.fetchStandardAnswer}
                />
              ) : !dual.state.isStreaming ? (
                /* 空状态 */
                <div className="rounded-xl border border-dashed border-border bg-surface px-6 py-16 text-center">
                  <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-surface-muted flex items-center justify-center">
                    <SparkleIcon className="w-6 h-6 text-ink-tertiary" />
                  </div>
                  <p className="font-serif text-lg text-ink">等待批改结果</p>
                  <p className="mt-1 text-sm text-ink-tertiary">请先在左侧输入题目和作答</p>
                </div>
              ) : (
                /* 加载中的骨架屏 */
                <div className="rounded-xl border border-border bg-surface p-5 animate-pulse">
                  <div className="flex items-center justify-between mb-5">
                    <div className="h-5 bg-surface-muted rounded w-24"></div>
                    <div className="h-4 bg-surface-muted rounded w-16"></div>
                  </div>
                  <div className="mb-6">
                    <div className="h-10 bg-surface-muted rounded-lg w-40 mb-3"></div>
                    <div className="h-2.5 bg-surface-muted rounded-full w-full mb-2"></div>
                  </div>
                  <div className="space-y-3">
                    <div className="h-6 bg-surface-muted rounded-lg w-full"></div>
                    <div className="h-6 bg-surface-muted rounded-lg w-5/6"></div>
                    <div className="h-6 bg-surface-muted rounded-lg w-4/6"></div>
                  </div>
                  <div className="mt-8 text-center">
                    <p className="text-base text-ink-secondary">AI 正在智能分析中...</p>
                    <p className="text-sm text-ink-tertiary mt-1.5">{statusText}</p>
                  </div>
                </div>
              )
            )}
            {mode === "multi" && (
              multi.state.providers.length === 0 && multi.state.results.length === 0 ? (
                !multi.state.isStreaming ? (
                  /* 空状态 */
                  <div className="rounded-xl border border-dashed border-border bg-surface px-6 py-16 text-center">
                    <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-surface-muted flex items-center justify-center">
                      <SparkleIcon className="w-6 h-6 text-ink-tertiary" />
                    </div>
                    <p className="font-serif text-lg text-ink">等待批改结果</p>
                    <p className="mt-1 text-sm text-ink-tertiary">请先在左侧输入题目和作答</p>
                  </div>
                ) : (
                  /* 加载中的骨架屏 */
                  <div className="rounded-xl border border-border bg-surface p-5 animate-pulse">
                    <div className="flex items-center justify-between mb-5">
                      <div className="h-5 bg-surface-muted rounded w-24"></div>
                      <div className="h-4 bg-surface-muted rounded w-16"></div>
                    </div>
                    <div className="mb-6">
                      <div className="h-10 bg-surface-muted rounded-lg w-40 mb-3"></div>
                      <div className="h-2.5 bg-surface-muted rounded-full w-full mb-2"></div>
                    </div>
                    <div className="space-y-3">
                      <div className="h-6 bg-surface-muted rounded-lg w-full"></div>
                      <div className="h-6 bg-surface-muted rounded-lg w-5/6"></div>
                      <div className="h-6 bg-surface-muted rounded-lg w-4/6"></div>
                    </div>
                    <div className="mt-8 text-center">
                      <p className="text-base text-ink-secondary">AI 正在智能分析中...</p>
                      <p className="text-sm text-ink-tertiary mt-1.5">{statusText}</p>
                    </div>
                  </div>
                )
              ) : (
                <MultiResultView
                  providers={multi.state.providers}
                  results={multi.state.results}
                  aggregate={multi.state.aggregate}
                  questionType={multi.state.questionType}
                  questionTypeSource={multi.state.questionTypeSource}
                  isStreaming={multi.state.isStreaming}
                />
              )
            )}
            {mode === "credibility" && (
              credibility.state.runScores.length === 0 && !credibility.state.result ? (
                !credibility.state.isStreaming ? (
                  /* 空状态 */
                  <div className="rounded-xl border border-dashed border-border bg-surface px-6 py-16 text-center">
                    <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-surface-muted flex items-center justify-center">
                      <SparkleIcon className="w-6 h-6 text-ink-tertiary" />
                    </div>
                    <p className="font-serif text-lg text-ink">等待可信度检验</p>
                    <p className="mt-1 text-sm text-ink-tertiary">请先在左侧输入题目和作答</p>
                  </div>
                ) : (
                  /* 加载中的骨架屏 */
                  <div className="rounded-xl border border-border bg-surface p-5 animate-pulse">
                    <div className="flex items-center justify-between mb-5">
                      <div className="h-5 bg-surface-muted rounded w-24"></div>
                      <div className="h-4 bg-surface-muted rounded w-16"></div>
                    </div>
                    <div className="mb-6">
                      <div className="h-10 bg-surface-muted rounded-lg w-40 mb-3"></div>
                      <div className="h-2.5 bg-surface-muted rounded-full w-full mb-2"></div>
                    </div>
                    <div className="space-y-3">
                      <div className="h-6 bg-surface-muted rounded-lg w-full"></div>
                      <div className="h-6 bg-surface-muted rounded-lg w-5/6"></div>
                      <div className="h-6 bg-surface-muted rounded-lg w-4/6"></div>
                    </div>
                    <div className="mt-8 text-center">
                      <p className="text-base text-ink-secondary">正在连续评分中...</p>
                      <p className="text-sm text-ink-tertiary mt-1.5">{statusText}</p>
                    </div>
                  </div>
                )
              ) : (
                <CredibilityResultView
                  provider={credibility.state.provider}
                  runScores={credibility.state.runScores}
                  result={credibility.state.result}
                  questionType={credibility.state.questionType}
                  questionTypeSource={credibility.state.questionTypeSource}
                  isStreaming={credibility.state.isStreaming}
                />
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
