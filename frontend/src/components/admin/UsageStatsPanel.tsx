"use client";

import { useEffect, useState } from "react";
import { API_BASE_URL } from "../../config/api";
import Card from "../ui/Card";
import Badge from "../ui/Badge";
import { AlertIcon, ChartIcon, LoaderIcon } from "../ui/icons";
import type { UsageRange, UsageStats } from "../../types/usage";
import { USAGE_RANGE_LABELS } from "../../types/usage";

const RANGES: UsageRange[] = ["today", "yesterday", "7d", "30d", "all"];

function formatTokens(n: number): string {
  const value = Number(n) || 0;
  if (value >= 10000) {
    const wan = value / 10000;
    return `${wan.toFixed(wan >= 100 ? 0 : 1)}万`;
  }
  return value.toLocaleString("zh-CN");
}

function formatCost(cost?: number | null): string {
  if (cost == null) return "—";
  return `¥${cost.toFixed(4)}`;
}

export default function UsageStatsPanel() {
  const [range, setRange] = useState<UsageRange>("today");
  const [data, setData] = useState<UsageStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async (r: UsageRange) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/v1/usage/stats?range=${r}&group_by=provider`
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as UsageStats;
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(range);
  }, [range]);

  const summaryCards = [
    { label: "调用次数", value: formatTokens(data?.summary.callCount ?? 0) },
    { label: "Prompt Token", value: formatTokens(data?.summary.promptTokens ?? 0) },
    { label: "Completion Token", value: formatTokens(data?.summary.completionTokens ?? 0) },
    { label: "总 Token", value: formatTokens(data?.summary.totalTokens ?? 0) },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex items-center gap-1 p-1 bg-surface-muted rounded-xl border border-border">
          {RANGES.map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-3.5 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                range === r
                  ? "bg-surface text-ink shadow-sm"
                  : "text-ink-tertiary hover:text-ink"
              }`}
            >
              {USAGE_RANGE_LABELS[r]}
            </button>
          ))}
        </div>
        {loading && (
          <div className="flex items-center text-sm text-ink-tertiary">
            <LoaderIcon className="animate-spin w-4 h-4 mr-2" />
            加载中...
          </div>
        )}
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-danger/10 text-danger border border-danger/20 flex items-center">
          <AlertIcon className="w-5 h-5 mr-2 flex-shrink-0" />
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {summaryCards.map((c) => (
          <Card key={c.label} className="p-5">
            <div className="text-xs text-ink-tertiary mb-1.5">{c.label}</div>
            <div className="font-serif text-2xl font-semibold text-ink">
              {c.value}
            </div>
          </Card>
        ))}
      </div>

      <Card>
        <div className="p-6 border-b border-border flex items-center justify-between">
          <h2 className="font-serif text-xl font-semibold text-ink flex items-center gap-2.5">
            <span className="w-2 h-2 rounded-full bg-accent"></span>
            按厂商明细（{USAGE_RANGE_LABELS[range]}）
          </h2>
          <div className="flex items-center gap-2 text-xs text-ink-tertiary">
            <ChartIcon className="w-4 h-4" />
            Token 单位：Prompt / Completion / 合计
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="py-3.5 px-6 font-medium text-ink-tertiary text-xs">厂商</th>
                <th className="py-3.5 px-4 font-medium text-ink-tertiary text-xs">模型</th>
                <th className="py-3.5 px-4 font-medium text-ink-tertiary text-xs text-right">调用次数</th>
                <th className="py-3.5 px-4 font-medium text-ink-tertiary text-xs text-right">Prompt</th>
                <th className="py-3.5 px-4 font-medium text-ink-tertiary text-xs text-right">Completion</th>
                <th className="py-3.5 px-4 font-medium text-ink-tertiary text-xs text-right">合计</th>
                <th className="py-3.5 px-6 font-medium text-ink-tertiary text-xs text-right">估算成本</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data?.items.map((it, idx) => (
                <tr key={`${it.providerId ?? it.providerName}-${idx}`} className="align-top hover:bg-surface-muted/50">
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-2.5">
                      <span className="w-7 h-7 rounded-lg bg-accent-soft text-accent flex items-center justify-center font-serif font-bold flex-shrink-0">
                        {(it.providerName || "?").charAt(0)}
                      </span>
                      <div>
                        <div className="font-medium text-ink">{it.providerName || "未知"}</div>
                        {it.providerType && (
                          <div className="text-xs text-ink-tertiary mt-0.5">
                            <Badge>{it.providerType}</Badge>
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-4 text-ink font-mono text-xs">{it.model || "—"}</td>
                  <td className="py-4 px-4 text-ink-secondary text-right">{it.callCount}</td>
                  <td className="py-4 px-4 text-ink-secondary text-right tabular-nums">{formatTokens(it.promptTokens)}</td>
                  <td className="py-4 px-4 text-ink-secondary text-right tabular-nums">{formatTokens(it.completionTokens)}</td>
                  <td className="py-4 px-4 text-ink font-medium text-right tabular-nums">{formatTokens(it.totalTokens)}</td>
                  <td className="py-4 px-6 text-ink-secondary text-right tabular-nums">{formatCost(it.estimatedCost)}</td>
                </tr>
              ))}
              {!loading && (!data || data.items.length === 0) && (
                <tr>
                  <td colSpan={7} className="py-16 text-center">
                    <div className="text-ink-tertiary">
                      当前时间窗暂无 Token 消耗数据
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
