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
import { useGradeMulti } from "../../hooks/useGradeMulti";
import { useProviders } from "../../hooks/useProviders";
import {
  HistoryIcon,
  SparkleIcon,
  XIcon,
} from "../../components/ui/icons";

export default function EssayPage() {
  const [questionMaterial, setQuestionMaterial] = useState<string>("");
  const [myAnswer, setMyAnswer] = useState<string>("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [progress, setProgress] = useState<number>(0);
  const { providers, loading: providersLoading } = useProviders();
  const { state, grade, stop } = useGradeMulti();

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
    if (!state.isStreaming) {
      setProgress(state.error ? 0 : state.aggregate ? 100 : 0);
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
  }, [state.isStreaming, state.error, state.aggregate]);

  const handleSubmit = async () => {
    if (!questionMaterial.trim()) {
      alert("请先填写题目材料或题干");
      return;
    }
    if (!myAnswer.trim()) {
      alert("请先填写你的作答");
      return;
    }
    if (selectedIds.length === 0) {
      alert("请至少选择一个阅卷模型");
      return;
    }

    const combinedContent = `【题目材料与题干】\n${questionMaterial}\n\n【我的作答】\n${myAnswer}`;
    await grade(combinedContent, selectedIds);

    // 保存学习记录到 localStorage（多模型结果）
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
  };

  return (
    <div className="min-h-screen bg-canvas pb-16 lg:pb-0 lg:pl-60">
      <Navigation />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <PageHeader
          title="申论智能批改"
          description="AI 专家级批改，支持多模型同时阅卷，个性化学习建议，助力公考申论高分突破。"
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

            {/* 阅卷模型选择 */}
            <ModelSelector
              providers={providers}
              selected={selectedIds}
              onChange={setSelectedIds}
              disabled={state.isStreaming}
            />

            {/* 进度条 */}
            {state.isStreaming && (
              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-ink-secondary">
                    {state.statusText || "AI 正在分析中..."}
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
              {state.isStreaming ? (
                <Button
                  onClick={stop}
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
                  disabled={!questionMaterial.trim() || !myAnswer.trim() || selectedIds.length === 0}
                  className="w-full"
                  size="lg"
                >
                  <SparkleIcon className="w-4 h-4" />
                  开始 AI 批改
                </Button>
              )}
            </div>
          </Card>

          {/* 右栏：结果展示区域 */}
          <div>
            {state.providers.length === 0 && state.results.length === 0 ? (
              !state.isStreaming ? (
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
                    <p className="text-sm text-ink-tertiary mt-1.5">{state.statusText}</p>
                  </div>
                </div>
              )
            ) : (
              <MultiResultView
                providers={state.providers}
                results={state.results}
                aggregate={state.aggregate}
                questionType={state.questionType}
                questionTypeSource={state.questionTypeSource}
                isStreaming={state.isStreaming}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
