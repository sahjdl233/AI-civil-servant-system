"use client";

import { useState } from "react";
import type {
  CoachResult,
  CombinedDualResult,
  DualRolePart1,
  DualRolePart2,
  GraderResult,
  ParagraphAdvice,
  StandardAnswerResult,
} from "../types/grading";
import Badge from "./ui/Badge";
import Button from "./ui/Button";
import Card from "./ui/Card";
import Disclosure from "./ui/Disclosure";
import ScoreBar from "./ui/ScoreBar";
import {
  AlertIcon,
  BookIcon,
  FileTextIcon,
  LoaderIcon,
  PenIcon,
  SparkleIcon,
  StarIcon,
} from "./ui/icons";

interface StandardAnswerState {
  loading: boolean;
  data?: StandardAnswerResult | null;
  error?: string | null;
}

interface DualRoleResultViewProps {
  grader?: GraderResult | null;
  coach?: CoachResult | null;
  combined?: CombinedDualResult | null;
  questionType?: string;
  questionTypeSource?: string;
  isStreaming: boolean;
  standardAnswer: StandardAnswerState;
  onFetchStandardAnswer: () => void;
}

const renderRichText = (text: string, size: "sm" | "base" = "base") =>
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

function RoleErrorCard({ name, message }: { name: string; message?: string }) {
  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 mb-3">
        <span className="w-8 h-8 rounded-lg bg-accent-soft text-accent flex items-center justify-center font-serif font-bold">
          {name.charAt(0)}
        </span>
        <span className="text-base font-medium text-ink">{name}</span>
        <Badge className="bg-danger/10 text-danger">失败</Badge>
      </div>
      <div className="rounded-lg border border-danger/20 bg-danger/5 p-4 flex items-start gap-3">
        <AlertIcon className="w-5 h-5 text-danger flex-shrink-0" />
        <div className="text-sm text-ink-secondary">
          {name}结果生成失败{message ? `：${message}` : ""}
        </div>
      </div>
    </Card>
  );
}

function GraderSection({ part1 }: { part1: DualRolePart1 | null }) {
  if (!part1) return <RoleErrorCard name="阅卷官" />;
  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 mb-4">
        <span className="w-8 h-8 rounded-lg bg-accent-soft text-accent flex items-center justify-center font-serif font-bold">
          阅
        </span>
        <div>
          <div className="text-base font-medium text-ink">第一部分 · 阅卷官</div>
          <div className="text-xs text-ink-tertiary">评分 · 扣分原因 · 评分依据</div>
        </div>
      </div>

      <div className="flex items-baseline gap-2 mb-2">
        <span className="font-serif text-4xl font-semibold text-ink">{part1.score}</span>
        <span className="text-sm text-ink-tertiary">分</span>
      </div>
      <ScoreBar value={part1.score} tone={scoreTone(part1.score)} className="h-2.5 mb-5" />

      <div className="mb-1 text-sm font-medium text-ink">主要失分</div>
      {part1.mainDeductions.length === 0 ? (
        <p className="text-sm text-ink-tertiary mb-4">未列出主要失分点</p>
      ) : (
        <ul className="space-y-2 mb-4">
          {part1.mainDeductions.map((d, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-danger/10 text-danger flex items-center justify-center text-xs font-semibold mt-0.5">
                {i + 1}
              </span>
              <div
                className="ai-feedback-content flex-1 leading-loose"
                dangerouslySetInnerHTML={{ __html: renderRichText(d, "sm") }}
              />
            </li>
          ))}
        </ul>
      )}

      {part1.scoringBasis && (
        <Disclosure
          title="评分依据"
          icon={<FileTextIcon className="w-5 h-5 text-accent" />}
        >
          <div
            className="ai-feedback-content"
            style={{ lineHeight: 1.9 }}
            dangerouslySetInnerHTML={{ __html: renderRichText(part1.scoringBasis, "sm") }}
          />
        </Disclosure>
      )}
    </Card>
  );
}

function RewritesBlock({ rewrites }: { rewrites: ParagraphAdvice["rewrites"] }) {
  if (!rewrites || rewrites.length === 0) return null;
  return (
    <div className="mt-3 space-y-2">
      <div className="text-sm font-medium text-ink">示例改写</div>
      {rewrites.map((r, i) => (
        <div key={i} className="rounded-lg border border-border bg-surface-muted/50 p-3">
          <div className="flex items-start gap-2 text-sm">
            <span className="text-ink-tertiary">原句</span>
            <span className="flex-1 text-ink-secondary line-through">
              {r.original || "—"}
            </span>
          </div>
          <div className="flex items-start gap-2 text-sm mt-1.5">
            <span className="text-accent font-medium">优化</span>
            <span className="flex-1 text-ink">{r.optimized || "—"}</span>
          </div>
          {r.why && <div className="mt-1.5 text-xs text-ink-tertiary">理由：{r.why}</div>}
        </div>
      ))}
    </div>
  );
}

function CoachSection({ part2 }: { part2: DualRolePart2 | null }) {
  if (!part2) return <RoleErrorCard name="写作教练" />;
  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 mb-4">
        <span className="w-8 h-8 rounded-lg bg-accent-soft text-accent flex items-center justify-center font-serif font-bold">
          教
        </span>
        <div>
          <div className="text-base font-medium text-ink">第二部分 · 写作教练</div>
          <div className="text-xs text-ink-tertiary">修改建议 · 语言优化 · 示例改写</div>
        </div>
      </div>

      <div className="space-y-4">
        {part2.paragraphAdvice.length === 0 && (
          <p className="text-sm text-ink-tertiary">未发现需要改进的段落</p>
        )}
        {part2.paragraphAdvice.map((pa, i) => (
          <div key={i} className="rounded-lg border border-border bg-surface-muted/50 p-4">
            <div className="flex items-center gap-2 mb-2">
              <StarIcon className="w-4 h-4 text-warning" />
              <span className="text-sm font-medium text-ink">{pa.paragraph || `段落 ${i + 1}`}</span>
            </div>
            {pa.diagnosis && (
              <div
                className="ai-feedback-content text-sm leading-loose mb-2"
                dangerouslySetInnerHTML={{ __html: renderRichText(pa.diagnosis, "sm") }}
              />
            )}
            {pa.suggestions && pa.suggestions.length > 0 && (
              <ul className="space-y-2">
                {pa.suggestions.map((s, j) => (
                  <li key={j} className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-accent-soft text-accent flex items-center justify-center text-xs font-semibold mt-0.5">
                      {j + 1}
                    </span>
                    <div
                      className="ai-feedback-content flex-1 text-sm leading-loose"
                      dangerouslySetInnerHTML={{ __html: renderRichText(s, "sm") }}
                    />
                  </li>
                ))}
              </ul>
            )}
            <RewritesBlock rewrites={pa.rewrites} />
          </div>
        ))}
      </div>

      {part2.overallAdvice && (
        <div className="mt-4">
          <Disclosure
            title="整体写作建议"
            icon={<PenIcon className="w-5 h-5 text-accent" />}
          >
            <div
              className="ai-feedback-content"
              style={{ lineHeight: 1.9 }}
              dangerouslySetInnerHTML={{ __html: renderRichText(part2.overallAdvice, "sm") }}
            />
          </Disclosure>
        </div>
      )}
    </Card>
  );
}

function StandardAnswerSection({
  standardAnswer,
  onFetchStandardAnswer,
}: {
  standardAnswer: StandardAnswerState;
  onFetchStandardAnswer: () => void;
}) {
  const [confirming, setConfirming] = useState(false);

  if (standardAnswer.loading) {
    return (
      <Card className="p-5">
        <div className="flex items-center gap-2 text-sm text-ink-secondary">
          <LoaderIcon className="w-4 h-4 animate-spin" />
          正在生成标准答案与解释...
        </div>
      </Card>
    );
  }

  if (standardAnswer.data) {
    return (
      <Card className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <BookIcon className="w-5 h-5 text-accent" />
          <span className="text-base font-medium text-ink">标准答案</span>
        </div>
        <Disclosure
          title="标准答案范文"
          icon={<FileTextIcon className="w-5 h-5 text-accent" />}
          defaultOpen
        >
          <div
            className="ai-feedback-content"
            style={{ lineHeight: 1.9 }}
            dangerouslySetInnerHTML={{
              __html: renderRichText(standardAnswer.data.standardAnswer, "base"),
            }}
          />
        </Disclosure>
        {standardAnswer.data.explanation && (
          <Disclosure
            title="标准答案解释"
            icon={<SparkleIcon className="w-5 h-5 text-accent" />}
          >
            <div
              className="ai-feedback-content"
              style={{ lineHeight: 1.9 }}
              dangerouslySetInnerHTML={{
                __html: renderRichText(standardAnswer.data.explanation, "sm"),
              }}
            />
          </Disclosure>
        )}
      </Card>
    );
  }

  if (standardAnswer.error) {
    return (
      <Card className="p-5">
        <div className="rounded-lg border border-danger/20 bg-danger/5 p-4 flex items-start gap-3">
          <AlertIcon className="w-5 h-5 text-danger flex-shrink-0" />
          <div className="text-sm text-ink-secondary">标准答案生成失败：{standardAnswer.error}</div>
        </div>
      </Card>
    );
  }

  if (confirming) {
    return (
      <Card className="p-5">
        <div className="flex items-center gap-2 mb-1">
          <BookIcon className="w-5 h-5 text-accent" />
          <span className="text-base font-medium text-ink">是否需要查看标准答案？</span>
        </div>
        <p className="text-sm text-ink-tertiary mb-4">
          查看标准答案可能影响自我复盘效果，请确认是否继续查看。
        </p>
        <div className="flex gap-3">
          <Button onClick={onFetchStandardAnswer}>确认查看</Button>
          <Button variant="ghost" onClick={() => setConfirming(false)}>
            取消
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <BookIcon className="w-5 h-5 text-accent" />
          <div>
            <div className="text-base font-medium text-ink">是否需要查看标准答案？</div>
            <div className="text-sm text-ink-tertiary">提供整篇范文与标准答案解释</div>
          </div>
        </div>
        <Button variant="secondary" onClick={() => setConfirming(true)}>
          查看标准答案
        </Button>
      </div>
    </Card>
  );
}

export default function DualRoleResultView({
  combined,
  questionType,
  questionTypeSource,
  isStreaming,
  standardAnswer,
  onFetchStandardAnswer,
}: DualRoleResultViewProps) {
  const part1 = combined?.part1 ?? null;
  const part2 = combined?.part2 ?? null;

  if (!part1 && !part2 && !isStreaming && !questionType) return null;

  return (
    <div className="animate-fade-in space-y-5">
      {questionType && (
        <div className="flex items-center gap-2 flex-wrap">
          <Badge>
            <SparkleIcon className="w-3 h-3" />
            识别题型：{questionType}
          </Badge>
          {questionTypeSource === "ai" && <Badge>AI 识别</Badge>}
        </div>
      )}

      <GraderSection part1={part1} />
      <CoachSection part2={part2} />

      {!isStreaming && (part1 || part2) && (
        <StandardAnswerSection
          standardAnswer={standardAnswer}
          onFetchStandardAnswer={onFetchStandardAnswer}
        />
      )}
    </div>
  );
}
