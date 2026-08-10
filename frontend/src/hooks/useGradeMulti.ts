"use client";

import { useRef, useState } from "react";
import { API_BASE_URL } from "../config/api";
import type {
  Aggregate,
  ModelResult,
  ModelsStartedEvent,
  ProviderRef,
} from "../types/grading";

export interface GradeMultiState {
  isStreaming: boolean;
  providers: ProviderRef[];
  results: ModelResult[];
  aggregate: Aggregate | null;
  questionType?: string;
  questionTypeSource?: string;
  error: string | null;
  statusText: string;
}

const initial: GradeMultiState = {
  isStreaming: false,
  providers: [],
  results: [],
  aggregate: null,
  questionType: undefined,
  questionTypeSource: undefined,
  error: null,
  statusText: "",
};

const sanitizeText = (text: unknown) => {
  if (typeof text !== "string" || !text) return text;
  let t = text;
  const patterns: RegExp[] = [
    /作为资深申论阅卷专家["'""]?悟道["'""]?的.*?[：:]\s*/g,
    /作为.*?阅卷专家.*?的.*?[：:]\s*/g,
    /悟道.*?专业.*?[：:]\s*/g,
    /深度专业诊断[：:]\s*/g,
  ];
  for (const p of patterns) t = t.replace(p, "");
  return t.trimStart();
};

const sanitizeResult = (result: ModelResult): ModelResult => {
  if (result.status === "error") return result;
  const details = result.scoreDetails?.map((d) => ({
    ...d,
    description: String(sanitizeText(d.description) ?? ""),
  }));
  return {
    ...result,
    feedback: String(sanitizeText(result.feedback) ?? ""),
    suggestions: (result.suggestions ?? []).map((s) => String(sanitizeText(s) ?? "")),
    scoreDetails: details,
  };
};

export function useGradeMulti() {
  const [state, setState] = useState<GradeMultiState>(initial);
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);

  const stop = () => {
    readerRef.current?.cancel().catch(() => {});
    readerRef.current = null;
  };

  const grade = async (content: string, providerIds: string[]) => {
    setState({
      ...initial,
      isStreaming: true,
      providers: [],
      results: [],
      aggregate: null,
      statusText: "初始化...",
    });

    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/essays/grade-multi`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
        body: JSON.stringify({ content, provider_ids: providerIds }),
      });
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

      const reader = res.body.getReader();
      readerRef.current = reader;
      const decoder = new TextDecoder("utf-8");
      let buffer = "";

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
            handleEvent(evt);
          } catch {
            // ignore malformed chunks
          }
        }
      }
      setState((s) => ({ ...s, isStreaming: false, statusText: "完成评估" }));
    } catch (e) {
      setState((s) => ({
        ...s,
        isStreaming: false,
        error: e instanceof Error ? e.message : "评分失败",
        statusText: "评分失败",
      }));
    } finally {
      readerRef.current = null;
    }
  };

  const handleEvent = (evt: Record<string, unknown>) => {
    const type = evt.type as string;
    if (type === "models_started") {
      const e = evt as unknown as ModelsStartedEvent;
      setState((s) => ({
        ...s,
        providers: e.providers ?? [],
        questionType: e.questionType,
        questionTypeSource: e.questionTypeSource,
        statusText: `已启动 ${e.providers?.length ?? 0} 个模型评分...`,
      }));
    } else if (type === "model_start") {
      const provider = evt.provider as ProviderRef;
      setState((s) => ({
        ...s,
        providers: upsertProvider(s.providers, provider),
        statusText: `${provider.name} 评分中...`,
      }));
    } else if (type === "model_result") {
      const result = sanitizeResult(evt as unknown as ModelResult);
      setState((s) => ({
        ...s,
        providers: upsertProvider(s.providers, result.provider),
        results: [...s.results, result],
        statusText: `${result.provider.name} 完成评分`,
      }));
    } else if (type === "model_error") {
      const result = evt as unknown as ModelResult;
      setState((s) => ({
        ...s,
        providers: upsertProvider(s.providers, result.provider),
        results: [...s.results, result],
        statusText: `${result.provider.name} 评分失败`,
      }));
    } else if (type === "done") {
      const done = evt as unknown as { results: ModelResult[]; aggregate: Aggregate };
      setState((s) => ({
        ...s,
        results: (done.results ?? []).map(sanitizeResult),
        aggregate: done.aggregate ?? null,
        statusText: "全部完成",
      }));
    } else if (type === "error") {
      setState((s) => ({
        ...s,
        error: String(evt.message ?? "评分服务异常"),
        statusText: "评分失败",
      }));
    }
  };

  return { state, grade, stop };
}

function upsertProvider(list: ProviderRef[], next: ProviderRef): ProviderRef[] {
  const exists = list.some((p) => p.id === next.id);
  return exists ? list.map((p) => (p.id === next.id ? next : p)) : [...list, next];
}
