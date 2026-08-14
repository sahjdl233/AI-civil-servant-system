"use client";

import type { DiffOp } from "../types/prompt";

interface PromptDiffProps {
  ops: DiffOp[];
  aLabel?: string;
  bLabel?: string;
}

const opStyles: Record<DiffOp["op"], string> = {
  eq: "text-ink-secondary",
  add: "bg-success/10 text-ink",
  del: "bg-danger/10 text-ink-tertiary line-through",
};

export default function PromptDiff({ ops, aLabel, bLabel }: PromptDiffProps) {
  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <div className="flex items-center gap-4 px-4 py-2 border-b border-border bg-surface-muted text-xs text-ink-tertiary font-mono">
        <span className="inline-flex items-center gap-1 text-success">
          <span className="w-1.5 h-1.5 rounded-full bg-success" />
          + {bLabel ?? "新版本"}
        </span>
        <span className="inline-flex items-center gap-1 text-danger">
          <span className="w-1.5 h-1.5 rounded-full bg-danger" />
          - {aLabel ?? "旧版本"}
        </span>
      </div>
      <pre className="max-h-[480px] overflow-auto p-0 m-0 text-xs leading-relaxed font-mono">
        {ops.length === 0 ? (
          <div className="px-4 py-6 text-center text-ink-tertiary">
            两个版本内容一致
          </div>
        ) : (
          ops.map((op, i) => (
            <div
              key={i}
              className={`px-4 py-0.5 whitespace-pre-wrap break-all ${opStyles[op.op]}`}
            >
              {op.op === "add" ? "+ " : op.op === "del" ? "- " : "  "}
              {op.line || " "}
            </div>
          ))
        )}
      </pre>
    </div>
  );
}
