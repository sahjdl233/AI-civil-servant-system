"use client";

import type { Aggregate, ModelResult, ProviderRef, ScoreDetail } from "../types/grading";
import Badge from "./ui/Badge";
import Card from "./ui/Card";
import Disclosure from "./ui/Disclosure";
import ScoreBar from "./ui/ScoreBar";
import {
  AlertIcon,
  FileTextIcon,
  LoaderIcon,
  PenIcon,
  SparkleIcon,
  StarIcon,
} from "./ui/icons";

interface MultiResultViewProps {
  providers: ProviderRef[];
  results: ModelResult[];
  aggregate: Aggregate | null;
  questionType?: string;
  questionTypeSource?: string;
  isStreaming: boolean;
}

const renderRichText = (text: string, size: "sm" | "base") =>
  String(text ?? "")
    .replace(/\\n/g, "\n")
    .replace(/\r\n/g, "\n")
    .replace(/\n\n+/g, '</p><p class="mt-3">')
    .replace(/\n/g, "<br/>")
    .replace(/\*\*(.*?)\*\*/g, '<strong class="text-ink font-semibold">$1</strong>')
    .replace(/^/, `<p class="${size === "sm" ? "text-[0.875rem]" : "text-[0.9375rem]"}">`)
    .replace(/$/, "</p>");

function scoreTone(score: number) {
  return score >= 80 ? "success" : score >= 60 ? "warning" : "danger";
}

function ScoreDetailsBlock({ details }: { details: ScoreDetail[] }) {
  const raw = details.reduce((s, d) => s + (d.fullScore || 0), 0);
  const scale = raw > 0 && Math.abs(raw - 100) > 0.1 ? 100 / raw : 1;

  return (
    <Disclosure
      title="评分细则"
      defaultOpen
      icon={<FileTextIcon className="w-5 h-5 text-accent" />}
    >
      <div className="space-y-3">
        {details.map((d, i) => {
          const full = Number((d.fullScore * scale).toFixed(1));
          const pct = full > 0 ? (d.actualScore / full) * 100 : 0;
          const tone = scoreTone(pct);
          return (
            <div key={i} className="rounded-lg border border-border bg-surface-muted/50 p-3.5">
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-sm font-medium text-ink">{d.item}</span>
                <span className={`text-sm font-semibold ${
                  tone === "success" ? "text-success" : tone === "warning" ? "text-warning" : "text-danger"
                }`}>
                  {d.actualScore} / {full} 分
                </span>
              </div>
              <ScoreBar value={pct} tone={tone} className="h-1.5" trackClassName="mb-2.5" />
              <div
                className="ai-feedback-content leading-loose"
                dangerouslySetInnerHTML={{ __html: renderRichText(d.description, "sm") }}
              />
            </div>
          );
        })}
      </div>
    </Disclosure>
  );
}

function FeedbackBlock({ title, icon, text }: { title: string; icon: React.ReactNode; text: string }) {
  if (!text) return null;
  return (
    <Disclosure title={title} icon={icon}>
      <div
        className="ai-feedback-content"
        style={{ lineHeight: 1.9 }}
        dangerouslySetInnerHTML={{ __html: renderRichText(text, "base") }}
      />
    </Disclosure>
  );
}

function SuggestionList({ suggestions }: { suggestions: string[] }) {
  if (!suggestions || suggestions.length === 0) return null;
  return (
    <Disclosure
      title="改进建议"
      icon={<SparkleIcon className="w-5 h-5 text-accent" />}
    >
      <ul className="space-y-4">
        {suggestions.map((s, i) => (
          <li key={i} className="flex items-start gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-accent-soft text-accent flex items-center justify-center text-xs font-semibold mt-0.5">
              {i + 1}
            </span>
            <div
              className="ai-feedback-content flex-1 leading-loose"
              dangerouslySetInnerHTML={{ __html: renderRichText(s, "base") }}
            />
          </li>
        ))}
      </ul>
    </Disclosure>
  );
}

export default function MultiResultView({
  providers,
  results,
  aggregate,
  questionType,
  questionTypeSource,
  isStreaming,
}: MultiResultViewProps) {
  if (providers.length === 0 && results.length === 0) return null;

  return (
    <div className="animate-fade-in space-y-5">
      {/* 题型识别 */}
      {questionType && (
        <div className="flex items-center gap-2 flex-wrap">
          <Badge>
            <SparkleIcon className="w-3 h-3" />
            识别题型：{questionType}
          </Badge>
          {questionTypeSource === "ai" && <Badge>AI 识别</Badge>}
        </div>
      )}

      {/* 汇总对比 */}
      {aggregate?.hasScore && (
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <StarIcon className="w-5 h-5 text-warning" />
            <span className="text-base font-medium text-ink">多模型汇总对比</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="rounded-lg bg-surface-muted p-3.5 text-center">
              <div className="text-xs text-ink-tertiary mb-1">平均分</div>
              <div className="font-serif text-2xl font-semibold text-ink">{aggregate.avgScore}</div>
            </div>
            <div className="rounded-lg bg-surface-muted p-3.5 text-center">
              <div className="text-xs text-ink-tertiary mb-1">最高分</div>
              <div className="font-serif text-2xl font-semibold text-success">{aggregate.maxScore}</div>
            </div>
            <div className="rounded-lg bg-surface-muted p-3.5 text-center">
              <div className="text-xs text-ink-tertiary mb-1">最低分</div>
              <div className="font-serif text-2xl font-semibold text-warning">{aggregate.minScore}</div>
            </div>
            <div className="rounded-lg bg-surface-muted p-3.5 text-center">
              <div className="text-xs text-ink-tertiary mb-1">分差</div>
              <div className="font-serif text-2xl font-semibold text-danger">{aggregate.diff}</div>
            </div>
          </div>
          {aggregate.rankings && aggregate.rankings.length > 1 && (
            <div className="mt-4 pt-4 border-t border-border">
              <div className="text-xs text-ink-tertiary mb-2">模型评分排序</div>
              <div className="flex flex-wrap items-center gap-2">
                {aggregate.rankings.map((r, i) => (
                  <Badge key={r.providerId} className={i === 0 ? "bg-accent-soft text-accent" : ""}>
                    {i === 0 && "领先 "}
                    {r.name} · {r.score} 分
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}

      {/* 逐模型独立卡片 */}
      {providers.map((provider) => {
        const result = results.find((r) => r.provider.id === provider.id);
        const pending = !result && isStreaming;
        return (
          <Card key={provider.id} className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <span className="w-8 h-8 rounded-lg bg-accent-soft text-accent flex items-center justify-center font-serif font-bold">
                  {provider.name.charAt(0)}
                </span>
                <div>
                  <div className="text-base font-medium text-ink">{provider.name}</div>
                  <div className="text-xs text-ink-tertiary">
                    {provider.type} · {provider.model}
                  </div>
                </div>
              </div>
              {pending && (
                <div className="flex items-center gap-2 text-sm text-ink-secondary">
                  <LoaderIcon className="w-4 h-4 animate-spin" />
                  评分中...
                </div>
              )}
              {result?.status === "success" && (
                <div className="text-right">
                  <span className="font-serif text-3xl font-semibold text-ink">{result.score}</span>
                  <span className="text-sm text-ink-tertiary ml-1">分</span>
                </div>
              )}
              {result?.status === "error" && (
                <Badge className="bg-danger/10 text-danger">评分失败</Badge>
              )}
            </div>

            {pending && (
              <div className="rounded-lg bg-surface-muted animate-pulse h-24" />
            )}

            {result?.status === "error" && (
              <div className="rounded-lg border border-danger/20 bg-danger/5 p-4 flex items-start gap-3">
                <AlertIcon className="w-5 h-5 text-danger flex-shrink-0" />
                <div>
                  <div className="text-sm font-medium text-danger mb-1">该模型评分失败</div>
                  <div className="text-sm text-ink-secondary">{result.message}</div>
                </div>
              </div>
            )}

            {result?.status === "success" && (
              <div className="space-y-4">
                <ScoreBar value={result.score ?? 0} tone={scoreTone(result.score ?? 0)} className="h-2.5" />
                {result.scoreDetails && result.scoreDetails.length > 0 && (
                  <ScoreDetailsBlock details={result.scoreDetails} />
                )}
                <FeedbackBlock
                  title="详细反馈"
                  icon={<PenIcon className="w-5 h-5 text-accent" />}
                  text={result.feedback ?? ""}
                />
                <SuggestionList suggestions={result.suggestions ?? []} />
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}
