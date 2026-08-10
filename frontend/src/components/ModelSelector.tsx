"use client";

import type { AiProvider } from "../types/provider";
import { CheckIcon } from "./ui/icons";

interface ModelSelectorProps {
  providers: AiProvider[];
  selected: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
}

export default function ModelSelector({
  providers,
  selected,
  onChange,
  disabled,
}: ModelSelectorProps) {
  const allSelected =
    providers.length > 0 && providers.every((p) => selected.includes(p.id));
  const someSelected = selected.length > 0 && !allSelected;

  const toggleAll = () => {
    if (allSelected) {
      onChange([]);
    } else {
      onChange(providers.map((p) => p.id));
    }
  };

  const toggle = (id: string) => {
    if (selected.includes(id)) {
      onChange(selected.filter((s) => s !== id));
    } else {
      onChange([...selected, id]);
    }
  };

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <label className="text-sm font-medium text-ink">阅卷模型</label>
        <button
          type="button"
          onClick={toggleAll}
          disabled={disabled || providers.length === 0}
          className={`inline-flex items-center gap-1.5 text-xs font-medium transition-colors ${
            disabled || providers.length === 0
              ? "text-ink-tertiary cursor-not-allowed"
              : "text-ink-secondary hover:text-ink"
          }`}
        >
          <span
            className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
              allSelected
                ? "bg-accent border-accent text-white"
                : someSelected
                ? "bg-accent-soft border-accent text-accent"
                : "bg-surface border-border"
            }`}
          >
            {allSelected && <CheckIcon className="w-3 h-3" strokeWidth={3} />}
            {!allSelected && someSelected && (
              <span className="w-1.5 h-1.5 rounded-full bg-accent" />
            )}
          </span>
          全选
        </button>
      </div>

      {providers.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-surface-muted px-4 py-5 text-center text-sm text-ink-tertiary">
          暂无可用的阅卷模型，请先在「模型管理」中添加 Provider
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {providers.map((p) => {
            const checked = selected.includes(p.id);
            return (
              <button
                key={p.id}
                type="button"
                disabled={disabled}
                onClick={() => toggle(p.id)}
                className={`flex items-center gap-3 rounded-lg border px-3.5 py-2.5 text-left transition-colors ${
                  checked
                    ? "border-accent bg-accent-soft"
                    : "border-border bg-surface hover:bg-surface-muted"
                } ${disabled ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
                aria-pressed={checked}
              >
                <span
                  className={`w-4.5 h-4.5 w-5 h-5 rounded-md border flex items-center justify-center flex-shrink-0 transition-colors ${
                    checked
                      ? "bg-accent border-accent text-white"
                      : "bg-surface border-border"
                  }`}
                >
                  {checked && <CheckIcon className="w-3.5 h-3.5" strokeWidth={3} />}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="flex items-center gap-2">
                    <span className={`text-sm font-medium truncate ${checked ? "text-ink" : "text-ink"}`}>
                      {p.name}
                    </span>
                    {p.is_default && (
                      <span className="flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded-full bg-accent text-white font-medium">
                        默认
                      </span>
                    )}
                  </span>
                  <span className="block text-xs text-ink-tertiary truncate">
                    {p.provider_type} · {p.model}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
