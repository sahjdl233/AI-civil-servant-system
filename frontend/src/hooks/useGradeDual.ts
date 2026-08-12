"use client";

import { useRef, useState } from "react";
import { API_BASE_URL } from "../config/api";
import type {
  CoachResult,
  CombinedDualResult,
  DualRoleRef,
  GraderResult,
  StandardAnswerResult,
} from "../types/grading";

export interface GradeDualState {
  isStreaming: boolean;
  roles: DualRoleRef[];
  statusText: string;
  error: string | null;
  questionType?: string;
  questionTypeSource?: string;
  grader?: GraderResult | null;
  coach?: CoachResult | null;
  combined?: CombinedDualResult | null;
  recordId?: string | null;
}

export interface StandardAnswerState {
  loading: boolean;
  data?: StandardAnswerResult | null;
  error?: string | null;
}

const initial: GradeDualState = {
  isStreaming: false,
  roles: [],
  statusText: "",
  error: null,
  questionType: undefined,
  questionTypeSource: undefined,
  grader: null,
  coach: null,
  combined: null,
  recordId: null,
};

const ROLE_NAMES: Record<string, string> = { grader: "阅卷官", coach: "写作教练" };

export function useGradeDual() {
  const [state, setState] = useState<GradeDualState>(initial);
  const [standardAnswer, setStandardAnswer] = useState<StandardAnswerState>({
    loading: false,
    data: null,
    error: null,
  });
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);
  const lastContentRef = useRef<string>("");
  const lastRecordIdRef = useRef<string | null>(null);

  const stop = () => {
    readerRef.current?.cancel().catch(() => {});
    readerRef.current = null;
  };

  const grade = async (content: string) => {
    lastContentRef.current = content;
    setState({ ...initial, isStreaming: true, statusText: "初始化..." });

    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/essays/grade-dual`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
        body: JSON.stringify({ content }),
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
      setState((s) => ({ ...s, isStreaming: false, statusText: "完成批改" }));
    } catch (e) {
      setState((s) => ({
        ...s,
        isStreaming: false,
        error: e instanceof Error ? e.message : "批改失败",
        statusText: "批改失败",
      }));
    } finally {
      readerRef.current = null;
    }
  };

  const handleEvent = (evt: Record<string, unknown>) => {
    const type = evt.type as string;
    if (type === "roles_started") {
      setState((s) => ({
        ...s,
        roles: (evt.roles as DualRoleRef[]) ?? [],
        questionType: evt.questionType as string,
        questionTypeSource: evt.questionTypeSource as string,
        statusText: "已启动双角色批改...",
      }));
    } else if (type === "role_start") {
      const role = evt.role as string;
      setState((s) => ({ ...s, statusText: `${ROLE_NAMES[role] ?? role} 分析中...` }));
    } else if (type === "role_result") {
      const role = evt.role as "grader" | "coach";
      setState((s) => ({
        ...s,
        [role]: evt.data as GraderResult & CoachResult,
        statusText: `${ROLE_NAMES[role] ?? role} 完成`,
      }));
    } else if (type === "role_error") {
      const role = evt.role as "grader" | "coach";
      setState((s) => ({
        ...s,
        [role]: null,
        statusText: `${ROLE_NAMES[role] ?? role} 失败`,
      }));
    } else if (type === "done") {
      setState((s) => ({
        ...s,
        grader: evt.grader as GraderResult | null,
        coach: evt.coach as CoachResult | null,
        combined: evt.combined as CombinedDualResult,
        questionType: evt.questionType as string,
        questionTypeSource: evt.questionTypeSource as string,
        statusText: "全部完成",
      }));
    } else if (type === "history_saved") {
      const recordId = evt.recordId as string;
      lastRecordIdRef.current = recordId;
      setState((s) => ({ ...s, recordId }));
    } else if (type === "error") {
      setState((s) => ({
        ...s,
        error: String(evt.message ?? "批改服务异常"),
        statusText: "批改失败",
      }));
    }
  };

  const fetchStandardAnswer = async () => {
    setStandardAnswer({ loading: true, data: null, error: null });
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/essays/standard-answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: lastContentRef.current,
          parent_id: lastRecordIdRef.current,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as StandardAnswerResult;
      setStandardAnswer({ loading: false, data, error: null });
    } catch (e) {
      setStandardAnswer({
        loading: false,
        data: null,
        error: e instanceof Error ? e.message : "标准答案生成失败",
      });
    }
  };

  return { state, standardAnswer, grade, stop, fetchStandardAnswer };
}
