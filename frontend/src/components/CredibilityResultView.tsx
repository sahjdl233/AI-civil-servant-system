"use client";

import type { CredibilityResult, ProviderRef } from "../types/grading";
import Badge from "./ui/Badge";
import Card from "./ui/Card";
import ScoreBar from "./ui/ScoreBar";
import { AlertIcon, LoaderIcon, SparkleIcon, StarIcon } from "./ui/icons";

interface CredibilityResultViewProps {
  provider: ProviderRef | null;
  runScores: (number | null)[];
  result: CredibilityResult | null;
  questionType?: string;
  questionTypeSource?: string;
  isStreaming: boolean;
}

function starText(stars: number) {
  if (stars <= 0) return "";
  return "★".repeat(stars) + "☆".repeat(5 - stars);
}

function starTone(stars: number) {
  if (stars >= 4) return "text-success";
  if (stars >= 3) return "text-warning";
  return "text-danger";
}

function scoreTone(score: number) {
  return score >= 80 ? "success" : score >= 60 ? "warning" : "danger";
}

export default function CredibilityResultView({
  provider,
  runScores,
  result,
  questionType,
  questionTypeSource,
  isStreaming,
}: CredibilityResultViewProps) {
  if (!result && runScores.length === 0) return null;

  return (
    <div className="animate-fade-in space-y-5">
      {/* 题型识别 + 模型 */}
      {(questionType || provider) && (
        <div className="flex items-center gap-2 flex-wrap">
          {questionType && (
            <Badge>
              <SparkleIcon className="w-3 h-3" />
              识别题型：{questionType}
            </Badge>
          )}
          {questionTypeSource === "ai" && <Badge>AI 识别</Badge>}
          {provider && (
            <Badge>
              {provider.name} · {provider.model}
            </Badge>
          )}
        </div>
      )}

      {/* 星级横幅 */}
      {result && (
        <Card className="p-6 text-center">
          <div className="text-xs text-ink-tertiary mb-3">评分可信度</div>
          {result.stars > 0 ? (
            <>
              <div className={`font-serif text-4xl font-bold tracking-widest ${starTone(result.stars)}`}>
                {starText(result.stars)}
              </div>
              <div className="mt-2 text-base font-medium text-ink">{result.level}</div>
              {result.credibilityScore !== null && (
                <div className="mt-1 text-sm text-ink-tertiary">
                  可信度评分 {result.credibilityScore} 分
                </div>
              )}
            </>
          ) : (
            <div className="text-base font-medium text-ink-tertiary">无法评估</div>
          )}
          {result.riskNote && (
            <div className="mt-4 inline-flex items-center gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3.5 py-2 text-sm font-medium text-warning">
              <AlertIcon className="w-4 h-4" />
              说明：{result.riskNote}
            </div>
          )}
        </Card>
      )}

      {/* 三次分数区 */}
      {runScores.length > 0 && (
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <StarIcon className="w-5 h-5 text-warning" />
            <span className="text-base font-medium text-ink">
              连续评分 {runScores.length} 次
            </span>
            {isStreaming && (
              <span className="flex items-center gap-1.5 text-sm text-ink-secondary">
                <LoaderIcon className="w-4 h-4 animate-spin" />
                评分中...
              </span>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {runScores.map((score, i) => (
              <div key={i} className="rounded-lg border border-border bg-surface-muted p-4">
                <div className="text-xs text-ink-tertiary mb-2">第 {i + 1} 次</div>
                {score === null ? (
                  <div className="flex items-center gap-2 text-sm text-danger">
                    <AlertIcon className="w-4 h-4" />
                    评分失败
                  </div>
                ) : (
                  <>
                    <div className="flex items-baseline gap-1">
                      <span className="font-serif text-3xl font-semibold text-ink">{score}</span>
                      <span className="text-sm text-ink-tertiary">分</span>
                    </div>
                    <ScoreBar value={score} tone={scoreTone(score)} className="h-1.5 mt-3" />
                  </>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* 统计区 */}
      {result?.statistics && (
        <Card className="p-5">
          <div className="text-base font-medium text-ink mb-4">统计指标</div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="rounded-lg bg-surface-muted p-3.5 text-center">
              <div className="text-xs text-ink-tertiary mb-1">均分</div>
              <div className="font-serif text-xl font-semibold text-ink">{result.statistics.mean}</div>
            </div>
            <div className="rounded-lg bg-surface-muted p-3.5 text-center">
              <div className="text-xs text-ink-tertiary mb-1">最低</div>
              <div className="font-serif text-xl font-semibold text-warning">{result.statistics.min}</div>
            </div>
            <div className="rounded-lg bg-surface-muted p-3.5 text-center">
              <div className="text-xs text-ink-tertiary mb-1">最高</div>
              <div className="font-serif text-xl font-semibold text-success">{result.statistics.max}</div>
            </div>
            <div className="rounded-lg bg-surface-muted p-3.5 text-center">
              <div className="text-xs text-ink-tertiary mb-1">极差</div>
              <div className="font-serif text-xl font-semibold text-ink">{result.statistics.range}</div>
            </div>
            <div className="rounded-lg bg-surface-muted p-3.5 text-center">
              <div className="text-xs text-ink-tertiary mb-1">标准差</div>
              <div className="font-serif text-xl font-semibold text-ink">{result.statistics.stdDev}</div>
            </div>
          </div>
        </Card>
      )}

      {/* 说明区 */}
      {result?.explanation && (
        <Card className="p-5">
          <div className="text-base font-medium text-ink mb-3">说明</div>
          <div className="text-sm leading-loose text-ink-secondary">{result.explanation}</div>
          {result.failedRounds && result.failedRounds.length > 0 && (
            <div className="mt-4 rounded-lg border border-warning/20 bg-warning/5 p-3.5 text-sm text-ink-secondary">
              部分轮次评分失败（第 {result.failedRounds.map((f) => f.index + 1).join("、")} 次），
              可信度基于其余轮次计算，结果仅供参考。
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
