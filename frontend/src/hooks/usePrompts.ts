"use client";

import { useCallback, useEffect, useState } from "react";
import { API_BASE_URL } from "../config/api";
import type {
  PromptTemplate,
  PromptVersion,
  DiffResult,
  VersionPayload,
} from "../types/prompt";

export function usePrompts() {
  const [items, setItems] = useState<PromptTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/prompts`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const api = useCallback(async (url: string, init?: RequestInit) => {
    const res = await fetch(`${API_BASE_URL}${url}`, {
      headers: { "Content-Type": "application/json" },
      ...init,
    });
    if (!res.ok) {
      const detail = await res.json().catch(() => ({}));
      throw new Error((detail as { detail?: string }).detail || `HTTP ${res.status}`);
    }
    return res.json();
  }, []);

  const getTemplate = useCallback(
    (id: string) => api(`/api/v1/prompts/${id}`),
    [api]
  );
  const createTemplate = useCallback(
    (payload: Record<string, unknown>) =>
      api("/api/v1/prompts", { method: "POST", body: JSON.stringify(payload) }),
    [api]
  );
  const updateTemplate = useCallback(
    (id: string, payload: Record<string, unknown>) =>
      api(`/api/v1/prompts/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
    [api]
  );
  const deleteTemplate = useCallback(
    (id: string) => api(`/api/v1/prompts/${id}`, { method: "DELETE" }),
    [api]
  );
  const listVersions = useCallback(
    (id: string) =>
      api(`/api/v1/prompts/${id}/versions`) as Promise<{ items: PromptVersion[] }>,
    [api]
  );
  const saveVersion = useCallback(
    (id: string, payload: VersionPayload) =>
      api(`/api/v1/prompts/${id}/versions`, {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    [api]
  );
  const publishVersion = useCallback(
    (id: string, versionId: string) =>
      api(`/api/v1/prompts/${id}/publish`, {
        method: "POST",
        body: JSON.stringify({ version_id: versionId }),
      }),
    [api]
  );
  const resetBuiltin = useCallback(
    (id: string, payload: { change_note?: string; publish?: boolean }) =>
      api(`/api/v1/prompts/${id}/reset`, {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    [api]
  );
  const preview = useCallback(
    (id: string, vars?: Record<string, string>) =>
      api(`/api/v1/prompts/${id}/preview`, {
        method: "POST",
        body: JSON.stringify({ vars }),
      }) as Promise<{ key: string; rendered: string }>,
    [api]
  );
  const diff = useCallback(
    (id: string, a: number, b: number) =>
      api(`/api/v1/prompts/${id}/diff?a=${a}&b=${b}`) as Promise<DiffResult>,
    [api]
  );

  return {
    items,
    loading,
    error,
    reload: load,
    getTemplate,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    listVersions,
    saveVersion,
    publishVersion,
    resetBuiltin,
    preview,
    diff,
  };
}
