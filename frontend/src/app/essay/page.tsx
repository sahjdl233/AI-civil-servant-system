"use client";

import { useRef, useState } from "react";
import Link from "next/link";

// Import API configuration
import { API_BASE_URL } from '../../config/api';
import Navigation from '../../components/Navigation';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import ScoreBar from '../../components/ui/ScoreBar';
import Disclosure from '../../components/ui/Disclosure';
import PageHeader from '../../components/ui/PageHeader';
import {
  HistoryIcon,
  StarIcon,
  FileTextIcon,
  PenIcon,
  SparkleIcon,
  LoaderIcon,
  XIcon,
} from '../../components/ui/icons';

const getApiUrl = () => {
  return API_BASE_URL;
};

interface ScoreDetail {
  item: string;
  fullScore: number;
  actualScore: number;
  description: string;
}

interface GradingResult {
  score: number;
  feedback: string;
  suggestions: string[];
  scoreDetails?: ScoreDetail[];
  questionType?: string;
  questionTypeSource?: "ai" | "client" | string;
}

export default function EssayPage() {
  const [questionMaterial, setQuestionMaterial] = useState<string>("");
  const [myAnswer, setMyAnswer] = useState<string>("");
  const [gradingResult, setGradingResult] = useState<GradingResult | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [statusText, setStatusText] = useState<string>("");
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startProgress = () => {
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
    setProgress(0);
    let current = 0;
    progressTimerRef.current = setInterval(() => {
      const inc = current < 60 ? 3 : current < 85 ? 1.5 : current < 95 ? 0.5 : 0.2;
      current = Math.min(99, current + inc);
      setProgress(current);
    }, 200);
  };

  const finishProgress = () => {
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
    setProgress(100);
  };

  // Hide internal prompt phrases from user-facing text
  const sanitizeText = (text: string) => {
    if (!text) return text;
    try {
      let t = text;
      const patterns: RegExp[] = [
        /作为资深申论阅卷专家["'""]?悟道["'""]?的.*?[：:]\s*/g,
        /作为.*?阅卷专家.*?的.*?[：:]\s*/g,
        /悟道.*?专业.*?[：:]\s*/g,
        /深度专业诊断[：:]\s*/g,
      ];
      for (const p of patterns) t = t.replace(p, "");
      return t.trimStart();
    } catch {
      return text;
    }
  };

  // Stream-first submit for better UX (partial results + live progress)
  const handleSubmitStream = async () => {
    if (!questionMaterial.trim()) {
      alert("请先填写题目材料或题干");
      return;
    }
    if (!myAnswer.trim()) {
      alert("请先填写你的作答");
      return;
    }

    setIsLoading(true);
    setStatusText("初始化...");
    startProgress();

    const combinedContent = `【题目材料与题干】\n${questionMaterial}\n\n【我的作答】\n${myAnswer}`;
    const apiUrl = getApiUrl();

    // Try progressive SSE over POST (fetch streaming)
    try {
      setStatusText("诊断中（阶段一）...");
      const res = await fetch(`${apiUrl}/api/v1/essays/grade-progressive`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "text/event-stream" },
        body: JSON.stringify({ content: combinedContent }),
      });
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

      // Stop local timer and use server-provided progress
      stopProgress();
      const reader = res.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";

      const toNumber = (v: unknown, def = 0) => {
        const n = typeof v === "number" ? v : parseFloat(String(v));
        return Number.isFinite(n) ? n : def;
      };
      const normalizeDetails = (details: unknown): ScoreDetail[] | undefined => {
        if (!details) return undefined;
        const detailsRecord = details as Record<string, unknown>;
        const arr = Array.isArray(details)
          ? (details as unknown[])
          : Array.isArray(detailsRecord?.data)
          ? (detailsRecord.data as unknown[])
          : Array.isArray(detailsRecord?.items)
          ? (detailsRecord.items as unknown[])
          : Array.isArray(detailsRecord?.scoreDetails)
          ? (detailsRecord.scoreDetails as unknown[])
          : Array.isArray(detailsRecord?.score_details)
          ? (detailsRecord.score_details as unknown[])
          : undefined;
        if (!arr) return undefined;
        const mapped = arr
          .map((d: unknown) => {
            const detail = d as Record<string, unknown>;
            return {
              item: String(detail?.item ?? detail?.name ?? detail?.title ?? ""),
              fullScore: toNumber(
                detail?.fullScore ?? detail?.full_score ?? detail?.full ?? detail?.max ?? 100,
                100
              ),
              actualScore: toNumber(
                detail?.actualScore ?? detail?.actual_score ?? detail?.score ?? detail?.value ?? 0,
                0
              ),
              description: String(detail?.description ?? detail?.desc ?? detail?.detail ?? ""),
            } as ScoreDetail;
          })
          .filter((d: ScoreDetail) => d.item !== "");
        return mapped.length ? mapped : undefined;
      };

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";
        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith("data:")) continue;
          const jsonStr = line.slice(5).trim();
          if (!jsonStr) continue;
          try {
            const evt = JSON.parse(jsonStr) as Record<string, unknown>;
            const stage = evt?.stage;
            const qType = evt?.questionType as string | undefined;
            const qSrc = evt?.questionTypeSource as string | undefined;

            if (stage === 1) {
              setProgress(toNumber(evt?.progress, 50));
              setStatusText("已完成诊断，生成维度细则...");
              setGradingResult({
                score: 0,
                feedback: String(evt?.teacherComments ?? ""),
                suggestions: [],
                scoreDetails: normalizeDetails(evt?.scoreDetails),
                questionType: qType,
                questionTypeSource: qSrc,
              });
            } else if (stage === 2) {
              setProgress(100);
              setStatusText("完成评估");
              const details = normalizeDetails(evt?.scoreDetails) ?? undefined;
              const finalResult = {
                score: toNumber(evt?.score, 0),
                feedback: sanitizeText(String(evt?.feedback ?? "")),
                suggestions: Array.isArray(evt?.suggestions)
                  ? (evt?.suggestions as unknown[]).map((s) => sanitizeText(String(s)))
                  : [],
                scoreDetails: details
                  ? details.map(d => ({ ...d, description: sanitizeText(d.description) }))
                  : undefined,
                questionType: qType,
                questionTypeSource: qSrc,
              } as GradingResult;

              setGradingResult((prev) => ({
                ...finalResult,
                scoreDetails: finalResult.scoreDetails || prev?.scoreDetails?.map(d => ({ ...d, description: sanitizeText(d.description) })),
                questionType: finalResult.questionType ?? prev?.questionType,
                questionTypeSource: finalResult.questionTypeSource ?? prev?.questionTypeSource,
              }));

              // 保存学习记录到localStorage
              try {
                const recordId = `essay_result_${Date.now()}`;
                const recordData = {
                  ...finalResult,
                  timestamp: new Date().toISOString(),
                  content: myAnswer.substring(0, 200) + (myAnswer.length > 200 ? '...' : ''),
                  questionMaterial: questionMaterial.substring(0, 200) + (questionMaterial.length > 200 ? '...' : '')
                };
                localStorage.setItem(recordId, JSON.stringify(recordData));
                console.log('学习记录已保存:', recordId);
              } catch (error) {
                console.log('保存学习记录失败:', error);
              }
            } else if (stage === "error") {
              throw new Error(String(evt?.message ?? "评分失败"));
            }
          } catch (err) {
            console.warn("SSE chunk parse failed", err);
          }
        }
      }

      setIsLoading(false);
      return;
    } catch (streamErr) {
      console.warn("Streaming failed, fallback to one-shot:", streamErr);
    }

    // Fallback: one-shot grading
    try {
      setStatusText("生成总体评估...");
      const response = await fetch(`${apiUrl}/api/v1/essays/grade`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: combinedContent }),
      });
      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        throw new Error(`HTTP error! status: ${response.status} ${errorText}`);
      }
      const raw: unknown = await response.json();
      const rawRecord = raw as Record<string, unknown>;
      const toNumber = (v: unknown, def = 0) => {
        const n = typeof v === "number" ? v : parseFloat(String(v));
        return Number.isFinite(n) ? n : def;
      };
      const normalizeDetails = (details: unknown): ScoreDetail[] | undefined => {
        if (!details) return undefined;
        const detailsRecord = details as Record<string, unknown>;
        const arr = Array.isArray(details)
          ? (details as unknown[])
          : Array.isArray(detailsRecord?.data)
          ? (detailsRecord.data as unknown[])
          : Array.isArray(detailsRecord?.items)
          ? (detailsRecord.items as unknown[])
          : Array.isArray(detailsRecord?.scoreDetails)
          ? (detailsRecord.scoreDetails as unknown[])
          : Array.isArray(detailsRecord?.score_details)
          ? (detailsRecord.score_details as unknown[])
          : undefined;
        if (!arr) return undefined;
        const mapped = arr
          .map((d: unknown) => {
            const detail = d as Record<string, unknown>;
            return {
              item: String(detail?.item ?? detail?.name ?? detail?.title ?? ""),
              fullScore: toNumber(
                detail?.fullScore ?? detail?.full_score ?? detail?.full ?? detail?.max ?? 100,
                100
              ),
              actualScore: toNumber(
                detail?.actualScore ?? detail?.actual_score ?? detail?.score ?? detail?.value ?? 0,
                0
              ),
              description: String(detail?.description ?? detail?.desc ?? detail?.detail ?? ""),
            } as ScoreDetail;
          })
          .filter((d: ScoreDetail) => d.item !== "");
        return mapped.length ? mapped : undefined;
      };

      const normalized: GradingResult = {
        score: toNumber(rawRecord?.score, 0),
        feedback: sanitizeText(
          typeof rawRecord?.feedback === "string" ? rawRecord.feedback : String(rawRecord?.feedback ?? "")
        ),
        suggestions: Array.isArray(rawRecord?.suggestions)
          ? (rawRecord.suggestions as unknown[]).map((s: unknown) => sanitizeText(String(s)))
          : rawRecord?.suggestions
          ? [sanitizeText(String(rawRecord.suggestions))]
          : [],
        scoreDetails: (normalizeDetails(rawRecord?.scoreDetails) ?? normalizeDetails(rawRecord?.score_details))?.map(d => ({
          ...d,
          description: sanitizeText(d.description),
        })),
        questionType: typeof rawRecord?.questionType === "string" ? rawRecord.questionType : undefined,
        questionTypeSource: typeof rawRecord?.questionTypeSource === "string" ? rawRecord.questionTypeSource : undefined,
      };
      if (!normalized.scoreDetails || normalized.scoreDetails.length === 0) {
        normalized.scoreDetails = [
          { item: "综合得分", fullScore: 100, actualScore: toNumber(normalized.score, 0), description: "系统未返回细则，按总分展示" },
        ];
      }
      setGradingResult(normalized);
      setStatusText("完成评估");

      // 保存学习记录到localStorage (fallback模式)
      try {
        const recordId = `essay_result_${Date.now()}`;
        const recordData = {
          ...normalized,
          timestamp: new Date().toISOString(),
          content: myAnswer.substring(0, 200) + (myAnswer.length > 200 ? '...' : ''),
          questionMaterial: questionMaterial.substring(0, 200) + (questionMaterial.length > 200 ? '...' : '')
        };
        localStorage.setItem(recordId, JSON.stringify(recordData));
        console.log('学习记录已保存 (fallback):', recordId);
      } catch (error) {
        console.log('保存学习记录失败 (fallback):', error);
      }

      finishProgress();
    } catch (error) {
      console.error("评分失败:", error);
      alert("评分失败：请检查网络或稍后重试");
    } finally {
      stopProgress();
      setIsLoading(false);
    }
  };

  // Stop progress without forcing completion
  const stopProgress = () => {
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
  };

  // Display normalization: scale "fullScore" so that totals sum to 100
  const displayScale = gradingResult?.scoreDetails?.length
    ? (() => {
        const raw = gradingResult.scoreDetails!.reduce((sum, d) => sum + d.fullScore, 0);
        return raw > 0 && Math.abs(raw - 100) > 0.1 ? 100 / raw : 1;
      })()
    : 1;

  // Convert markdown-ish plain text to safe HTML (presentation only)
  const renderRichText = (text: string, size: "sm" | "base") =>
    text
      .replace(/\\n/g, '\n')
      .replace(/\r\n/g, '\n')
      .replace(/\n\n+/g, '</p><p class="mt-3">')
      .replace(/\n/g, '<br/>')
      .replace(/\*\*(.*?)\*\*/g, '<strong class="text-ink font-semibold">$1</strong>')
      .replace(/^/, `<p class="${size === "sm" ? "text-[0.875rem]" : "text-[0.9375rem]"}">`)
      .replace(/$/, '</p>');

  return (
    <div className="min-h-screen bg-canvas pb-16 lg:pb-0 lg:pl-60">
      <Navigation />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <PageHeader
          title="申论智能批改"
          description="AI 专家级批改，个性化学习建议，渐进式反馈，助力公考申论高分突破。"
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

            {/* 进度条 */}
            {isLoading && (
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
              <Button
                onClick={handleSubmitStream}
                disabled={isLoading || !questionMaterial.trim() || !myAnswer.trim()}
                className="w-full"
                size="lg"
              >
                {isLoading ? (
                  <>
                    <LoaderIcon className="w-4 h-4 animate-spin" />
                    批改中...
                  </>
                ) : (
                  "开始 AI 批改"
                )}
              </Button>
            </div>
          </Card>

          {/* 右栏：结果展示区域 */}
          <div>
            {!gradingResult ? (
              !isLoading ? (
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
                    <div className="flex justify-between">
                      <div className="h-3 bg-surface-muted rounded w-8"></div>
                      <div className="h-3 bg-surface-muted rounded w-12"></div>
                    </div>
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
              <div className="animate-fade-in">
                {/* 题型识别 */}
                {gradingResult.questionType && (
                  <div className="mb-4 flex items-center gap-2 flex-wrap">
                    <Badge>
                      <SparkleIcon className="w-3 h-3" />
                      识别题型：{gradingResult.questionType}
                    </Badge>
                    {gradingResult.questionTypeSource === "ai" && <Badge>AI 识别</Badge>}
                  </div>
                )}

                {/* 综合评分 */}
                <Card className="p-5 mb-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <StarIcon className="w-5 h-5 text-warning" />
                      <span className="text-base font-medium text-ink">综合评分</span>
                    </div>
                    <div className="text-right">
                      <span className="font-serif text-4xl font-semibold text-ink">
                        {gradingResult.score}
                      </span>
                      <span className="text-base text-ink-tertiary ml-1">分</span>
                    </div>
                  </div>
                  <ScoreBar value={gradingResult.score} className="h-2.5" />
                  <div className="flex justify-between text-xs text-ink-tertiary mt-2">
                    <span>0 分</span>
                    <span>100 分</span>
                  </div>
                </Card>

                {/* 评分细则 */}
                {gradingResult.scoreDetails && gradingResult.scoreDetails.length > 0 && (
                  <Card className="mb-5 overflow-hidden">
                    <Disclosure
                      title="评分细则"
                      defaultOpen
                      icon={<FileTextIcon className="w-5 h-5 text-accent" />}
                    >
                      {/* 桌面端表格 */}
                      <div className="hidden md:block overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-border">
                              <th className="text-left py-2.5 pr-4 font-medium text-ink-tertiary text-xs">评分项</th>
                              <th className="text-center py-2.5 px-2 font-medium text-ink-tertiary text-xs">满分</th>
                              <th className="text-center py-2.5 px-2 font-medium text-ink-tertiary text-xs">得分</th>
                              <th className="text-left py-2.5 pl-4 font-medium text-ink-tertiary text-xs">评分说明</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            {gradingResult.scoreDetails.map((detail, index) => {
                              const scaledFull = Number((detail.fullScore * displayScale).toFixed(1));
                              const scorePercentage = (detail.actualScore / (scaledFull || 1)) * 100;
                              const tone = scorePercentage >= 80
                                ? "success"
                                : scorePercentage >= 60
                                ? "warning"
                                : "danger";
                              return (
                                <tr key={index} className="align-top">
                                  <td className="py-3.5 pr-4 whitespace-nowrap font-medium text-ink">
                                    {detail.item}
                                  </td>
                                  <td className="py-3.5 px-2 text-center text-ink-secondary">
                                    {scaledFull} 分
                                  </td>
                                  <td className="py-3.5 px-2 text-center">
                                    <span className={`font-semibold ${
                                      tone === "success"
                                        ? "text-success"
                                        : tone === "warning"
                                        ? "text-warning"
                                        : "text-danger"
                                    }`}>
                                      {detail.actualScore} 分
                                    </span>
                                    <ScoreBar
                                      value={scorePercentage}
                                      tone={tone}
                                      className="h-1.5 mt-1.5"
                                    />
                                  </td>
                                  <td className="py-3.5 pl-4 text-ink-secondary">
                                    <div
                                      className="ai-feedback-content leading-loose"
                                      dangerouslySetInnerHTML={{
                                        __html: renderRichText(detail.description, "sm"),
                                      }}
                                    />
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      {/* 移动端卡片 */}
                      <div className="md:hidden space-y-3">
                        {gradingResult.scoreDetails.map((detail, index) => {
                          const scaledFull = Number((detail.fullScore * displayScale).toFixed(1));
                          const scorePercentage = (detail.actualScore / (scaledFull || 1)) * 100;
                          const tone = scorePercentage >= 80
                            ? "success"
                            : scorePercentage >= 60
                            ? "warning"
                            : "danger";
                          return (
                            <div key={index} className="rounded-lg border border-border p-3.5">
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-medium text-ink text-sm">{detail.item}</span>
                                <span className={`text-sm font-semibold ${
                                  tone === "success"
                                    ? "text-success"
                                    : tone === "warning"
                                    ? "text-warning"
                                    : "text-danger"
                                }`}>
                                  {detail.actualScore} / {scaledFull} 分
                                </span>
                              </div>
                              <ScoreBar value={scorePercentage} tone={tone} className="h-1.5 mt-2" />
                              <div
                                className="ai-feedback-content leading-loose mt-2"
                                dangerouslySetInnerHTML={{
                                  __html: renderRichText(detail.description, "sm"),
                                }}
                              />
                            </div>
                          );
                        })}
                      </div>
                    </Disclosure>
                  </Card>
                )}

                {/* 详细反馈 */}
                {gradingResult.feedback && (
                  <Card className="mb-5 overflow-hidden">
                    <Disclosure
                      title="详细反馈"
                      icon={<PenIcon className="w-5 h-5 text-accent" />}
                    >
                      <div
                        className="ai-feedback-content"
                        style={{ lineHeight: 1.9 }}
                        dangerouslySetInnerHTML={{
                          __html: renderRichText(gradingResult.feedback, "base"),
                        }}
                      />
                    </Disclosure>
                  </Card>
                )}

                {/* 改进建议 */}
                {gradingResult.suggestions && gradingResult.suggestions.length > 0 && (
                  <Card className="overflow-hidden">
                    <Disclosure
                      title="改进建议"
                      icon={<SparkleIcon className="w-5 h-5 text-accent" />}
                    >
                      <ul className="space-y-4">
                        {gradingResult.suggestions.map((suggestion, index) => (
                          <li key={index} className="flex items-start gap-3">
                            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-accent-soft text-accent flex items-center justify-center text-xs font-semibold mt-0.5">
                              {index + 1}
                            </span>
                            <div
                              className="ai-feedback-content flex-1 leading-loose"
                              dangerouslySetInnerHTML={{
                                __html: renderRichText(suggestion, "base"),
                              }}
                            />
                          </li>
                        ))}
                      </ul>
                    </Disclosure>
                  </Card>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
