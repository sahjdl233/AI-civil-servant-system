export interface UsageItem {
  providerId?: string | null;
  providerName?: string | null;
  providerType?: string | null;
  model?: string | null;
  scene?: string | null;
  callCount: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCost?: number | null;
}

export interface UsageSummary {
  callCount: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface UsageStats {
  range: string;
  start?: string | null;
  end?: string | null;
  groupBy: string;
  summary: UsageSummary;
  items: UsageItem[];
}

export type UsageRange = "today" | "yesterday" | "7d" | "30d" | "all";

export const USAGE_RANGE_LABELS: Record<UsageRange, string> = {
  today: "今天",
  yesterday: "昨天",
  "7d": "近7天",
  "30d": "近30天",
  all: "全部",
};
