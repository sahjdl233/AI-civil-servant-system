"use client";

import { useRef, useState } from "react";
import { API_BASE_URL } from "../config/api";
import type {
  CredibilityResult,
  ProviderRef,
  RunsStartedEvent,
} from "../types/grading";

export interface GradeCredibilityState {
  isStreaming: boolean;
  provider: ProviderRef | null;
  rounds: number;
  runScores: (number | null)[]; // 每轮分数，null=失败
  result: CredibilityResult | null;
  questionType?: string;
  questionTypeSource?: string;
  error: string | null;
  statusText: string;
}

const initial: GradeCredibilityState = {
  isStreaming: false,
  provider: null,
  rounds: 0,
  runScores: [],
  result: null,
  questionType: undefined,
  questionTypeSource: undefined,
  error: null,
  statusText: "",
};

export function useGradeCredibility() {
  const [state, setState] = useState<GradeCredibilityState>(initial);
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);

  const stop = () => {
    readerRef.current?.cancel().catch(() => {});
    readerRef.current = null;
  };

  const grade = async (content: string, providerId?: string, rounds?: number) => {
    setState({
      ...initial,
      isStreaming: true,
      statusText: "初始化...",
    });

    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/essays/grade-credibility`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
        body: JSON.stringify({ content, provider_id: providerId, rounds }),
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
            handleEvent(JSON.parse(jsonStr) as Record<string, unknown>);
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
    if (type === "runs_started") {
      const e = evt as unknown as RunsStartedEvent;
      setState((s) => ({
        ...s,
        provider: e.provider ?? null,
        rounds: e.rounds ?? 0,
        runScores: Array(e.rounds ?? 0).fill(null),
        questionType: e.questionType,
        questionTypeSource: e.questionTypeSource,
        statusText: `将连续评分 ${e.rounds ?? 0} 次...`,
      }));
    } else if (type === "run_result") {
      const { index, score } = evt as { index: number; score: number };
      setState((s) => {
        const runScores = [...s.runScores];
        if (index >= 0 && index < runScores.length) runScores[index] = score;
        return {
          ...s,
          runScores,
          statusText: `第 ${index + 1} 次评分完成：${score} 分`,
        };
      });
    } else if (type === "run_error") {
      const { index } = evt as { index: number };
      setState((s) => {
        const runScores = [...s.runScores];
        if (index >= 0 && index < runScores.length) runScores[index] = null;
        return { ...s, runScores, statusText: `第 ${index + 1} 次评分失败` };
      });
    } else if (type === "done") {
      setState((s) => ({
        ...s,
        result: evt as unknown as CredibilityResult,
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
