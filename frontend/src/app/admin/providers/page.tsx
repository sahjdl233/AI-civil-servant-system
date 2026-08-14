"use client";

import { useEffect, useState } from "react";
import { API_BASE_URL } from "../../../config/api";
import Navigation from "../../../components/Navigation";
import Card from "../../../components/ui/Card";
import Badge from "../../../components/ui/Badge";
import Button from "../../../components/ui/Button";
import PageHeader from "../../../components/ui/PageHeader";
import type { AiProvider, ProviderPayload, ProviderTestResult } from "../../../types/provider";
import PromptLibraryPanel from "../../../components/admin/PromptLibraryPanel";
import {
  AlertIcon,
  CheckIcon,
  LoaderIcon,
  PlusIcon,
  TrashIcon,
  XIcon,
} from "../../../components/ui/icons";

const PROVIDER_TYPES = [
  { value: "openai", label: "OpenAI" },
  { value: "claude", label: "Claude" },
  { value: "gemini", label: "Gemini" },
  { value: "deepseek", label: "DeepSeek" },
  { value: "qwen", label: "Qwen" },
  { value: "custom", label: "自定义 (OpenAI 兼容)" },
];

const TYPE_PLACEHOLDER: Record<string, string> = {
  openai: "https://api.openai.com/v1",
  claude: "https://api.anthropic.com",
  gemini: "https://generativelanguage.googleapis.com",
  deepseek: "https://api.deepseek.com/v1",
  qwen: "https://dashscope.aliyuncs.com/compatible-mode/v1",
  custom: "https://your-gateway.example.com/v1",
};

const MODEL_PLACEHOLDER: Record<string, string> = {
  openai: "gpt-4o",
  claude: "claude-3-5-sonnet-latest",
  gemini: "gemini-1.5-pro",
  deepseek: "deepseek-chat",
  qwen: "qwen-max",
  custom: "your-model-name",
};

export default function AdminProvidersPage() {
  const [items, setItems] = useState<AiProvider[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<AiProvider | null>(null);
  const [saving, setSaving] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, ProviderTestResult>>({});
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"providers" | "prompts">("providers");

  // 表单状态
  const [form, setForm] = useState<ProviderPayload>({
    name: "",
    provider_type: "custom",
    base_url: "",
    api_key: "",
    model: "",
    is_default: false,
    is_enabled: true,
    timeout: 180,
  });

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/providers`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const resetForm = () => {
    setForm({
      name: "",
      provider_type: "custom",
      base_url: "",
      api_key: "",
      model: "",
      is_default: false,
      is_enabled: true,
      timeout: 180,
    });
    setEditing(null);
  };

  const openCreate = () => {
    resetForm();
    setShowForm(true);
  };

  const openEdit = (p: AiProvider) => {
    setEditing(p);
    setForm({
      name: p.name,
      provider_type: p.provider_type,
      base_url: p.base_url ?? "",
      api_key: "",
      model: p.model,
      is_default: p.is_default,
      is_enabled: p.is_enabled,
      timeout: p.timeout,
    });
    setShowForm(true);
  };

  const handleTypeChange = (type: string) => {
    setForm((f) => ({
      ...f,
      provider_type: type,
      base_url: f.base_url && f.base_url !== TYPE_PLACEHOLDER[f.provider_type] ? f.base_url : TYPE_PLACEHOLDER[type],
      model: f.model && f.model !== MODEL_PLACEHOLDER[f.provider_type] ? f.model : MODEL_PLACEHOLDER[type],
    }));
  };

  const save = async () => {
    if (!form.name.trim() || !form.model.trim()) {
      alert("请填写名称和模型名");
      return;
    }
    if (!editing && !form.api_key) {
      alert("请填写 API Key");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = { ...form };
      if (editing && !payload.api_key) delete payload.api_key;
      const url = editing
        ? `${API_BASE_URL}/api/v1/providers/${editing.id}`
        : `${API_BASE_URL}/api/v1/providers`;
      const res = await fetch(url, {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        throw new Error((detail as { detail?: string }).detail || `HTTP ${res.status}`);
      }
      setShowForm(false);
      resetForm();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (p: AiProvider) => {
    if (!confirm(`确定删除 Provider「${p.name}」？`)) return;
    setDeletingId(p.id);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/providers/${p.id}`, { method: "DELETE" });
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        throw new Error((detail as { detail?: string }).detail || `HTTP ${res.status}`);
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "删除失败");
    } finally {
      setDeletingId(null);
    }
  };

  const test = async (p: AiProvider) => {
    setTestingId(p.id);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/providers/${p.id}/test`, { method: "POST" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as ProviderTestResult;
      setTestResults((prev) => ({ ...prev, [p.id]: data }));
    } catch (e) {
      setTestResults((prev) => ({
        ...prev,
        [p.id]: { ok: false, message: e instanceof Error ? e.message : "测试失败" },
      }));
    } finally {
      setTestingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-canvas pb-16 lg:pb-0 lg:pl-60">
      <Navigation />

      <div className="mx-auto max-w-6xl px-4 py-8">
        <PageHeader
          title="设置"
          description="配置阅卷 AI Provider（API Base URL / 密钥 / 模型），以及维护 Prompt 库（题型识别、诊断、阅卷、Coach、Consensus 等模板）。"
          actions={
            activeTab === "providers" ? (
              <Button onClick={openCreate}>
                <PlusIcon className="w-4 h-4" />
                新增 Provider
              </Button>
            ) : undefined
          }
        />

        <div className="mb-6 inline-flex items-center gap-1 p-1 bg-surface-muted rounded-xl border border-border">
          <button
            onClick={() => setActiveTab("providers")}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              activeTab === "providers"
                ? "bg-surface text-ink shadow-sm"
                : "text-ink-tertiary hover:text-ink"
            }`}
          >
            设置
          </button>
          <button
            onClick={() => setActiveTab("prompts")}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              activeTab === "prompts"
                ? "bg-surface text-ink shadow-sm"
                : "text-ink-tertiary hover:text-ink"
            }`}
          >
            Prompt 库
          </button>
        </div>

        {activeTab === "prompts" ? (
          <PromptLibraryPanel />
        ) : (
          <>
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-danger/10 text-danger border border-danger/20 flex items-center">
            <AlertIcon className="w-5 h-5 mr-2 flex-shrink-0" />
            {error}
          </div>
        )}

        <Card>
          <div className="p-6 border-b border-border flex items-center justify-between">
            <h2 className="font-serif text-xl font-semibold text-ink flex items-center gap-2.5">
              <span className="w-2 h-2 rounded-full bg-accent"></span>
              Provider 列表
            </h2>
            {loading && (
              <div className="flex items-center text-sm text-ink-tertiary">
                <LoaderIcon className="animate-spin w-4 h-4 mr-2" />
                加载中...
              </div>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="py-3.5 px-6 font-medium text-ink-tertiary text-xs">名称</th>
                  <th className="py-3.5 px-4 font-medium text-ink-tertiary text-xs">类型</th>
                  <th className="py-3.5 px-4 font-medium text-ink-tertiary text-xs">模型</th>
                  <th className="py-3.5 px-4 font-medium text-ink-tertiary text-xs">Base URL</th>
                  <th className="py-3.5 px-4 font-medium text-ink-tertiary text-xs">状态</th>
                  <th className="py-3.5 px-6 font-medium text-ink-tertiary text-xs text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {items.map((p) => {
                  const testResult = testResults[p.id];
                  return (
                    <tr key={p.id} className="align-top hover:bg-surface-muted/50">
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-2.5">
                          <span className="w-7 h-7 rounded-lg bg-accent-soft text-accent flex items-center justify-center font-serif font-bold flex-shrink-0">
                            {p.name.charAt(0)}
                          </span>
                          <div>
                            <div className="font-medium text-ink flex items-center gap-2">
                              {p.name}
                              {p.is_default && (
                                <Badge className="bg-accent text-white">默认</Badge>
                              )}
                            </div>
                            <div className="text-xs text-ink-tertiary font-mono mt-0.5">
                              {p.api_key_masked || ""}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-ink-secondary">
                        <Badge>{p.provider_type}</Badge>
                      </td>
                      <td className="py-4 px-4 text-ink font-mono text-xs">{p.model}</td>
                      <td className="py-4 px-4 text-ink-secondary font-mono text-xs break-all max-w-[180px]">
                        {p.base_url || "—"}
                      </td>
                      <td className="py-4 px-4">
                        <Badge
                          className={
                            p.is_enabled
                              ? "bg-success/10 text-success"
                              : "bg-surface-muted text-ink-tertiary"
                          }
                        >
                          {p.is_enabled ? "启用" : "停用"}
                        </Badge>
                        {testResult && (
                          <div
                            className={`mt-1.5 text-xs ${
                              testResult.ok ? "text-success" : "text-danger"
                            }`}
                          >
                            {testResult.ok ? "连接正常" : "连接失败"}
                            {testResult.latency_ms != null && ` · ${testResult.latency_ms}ms`}
                          </div>
                        )}
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="secondary"
                            size="md"
                            onClick={() => test(p)}
                            disabled={testingId === p.id}
                            className="!h-9 !px-3 !text-xs"
                          >
                            {testingId === p.id ? (
                              <LoaderIcon className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <CheckIcon className="w-3.5 h-3.5" />
                            )}
                            测试
                          </Button>
                          <Button
                            variant="secondary"
                            size="md"
                            onClick={() => openEdit(p)}
                            className="!h-9 !px-3 !text-xs"
                          >
                            编辑
                          </Button>
                          <button
                            onClick={() => remove(p)}
                            disabled={deletingId === p.id || p.is_default}
                            title={p.is_default ? "默认 Provider 不可删除" : "删除"}
                            className={`inline-flex items-center gap-1 h-9 px-3 text-xs font-medium rounded-lg border border-border transition-colors ${
                              p.is_default
                                ? "text-ink-tertiary opacity-40 cursor-not-allowed"
                                : "text-danger bg-surface hover:bg-danger/10"
                            }`}
                          >
                            <TrashIcon className="w-3.5 h-3.5" />
                            {deletingId === p.id ? "删除中..." : "删除"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {!loading && items.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-16 text-center">
                      <div className="text-ink-tertiary">暂无 Provider，点击右上角「新增 Provider」开始配置</div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
          </>
        )}
      </div>

      {/* 新增/编辑弹窗 */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/40">
          <div className="bg-surface rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto border border-border">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h3 className="font-serif text-lg font-semibold text-ink">
                {editing ? "编辑 Provider" : "新增 Provider"}
              </h3>
              <button
                onClick={() => setShowForm(false)}
                className="p-1.5 text-ink-tertiary hover:text-ink rounded-md transition-colors"
                aria-label="关闭"
              >
                <XIcon className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-ink mb-1.5">名称</label>
                  <input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="如 GPT-5 / DeepSeek V3"
                    className="w-full h-10 px-3 text-sm bg-surface border border-border rounded-lg focus:border-accent focus:ring-2 focus:ring-accent/15 outline-none text-ink placeholder:text-ink-tertiary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-ink mb-1.5">类型</label>
                  <select
                    value={form.provider_type}
                    onChange={(e) => handleTypeChange(e.target.value)}
                    className="w-full h-10 px-3 text-sm bg-surface border border-border rounded-lg focus:border-accent focus:ring-2 focus:ring-accent/15 outline-none text-ink"
                  >
                    {PROVIDER_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-ink mb-1.5">Base URL</label>
                <input
                  value={form.base_url ?? ""}
                  onChange={(e) => setForm({ ...form, base_url: e.target.value })}
                  placeholder={TYPE_PLACEHOLDER[form.provider_type]}
                  className="w-full h-10 px-3 text-sm font-mono bg-surface border border-border rounded-lg focus:border-accent focus:ring-2 focus:ring-accent/15 outline-none text-ink placeholder:text-ink-tertiary"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-ink mb-1.5">模型名</label>
                  <input
                    value={form.model}
                    onChange={(e) => setForm({ ...form, model: e.target.value })}
                    placeholder={MODEL_PLACEHOLDER[form.provider_type]}
                    className="w-full h-10 px-3 text-sm font-mono bg-surface border border-border rounded-lg focus:border-accent focus:ring-2 focus:ring-accent/15 outline-none text-ink placeholder:text-ink-tertiary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-ink mb-1.5">
                    API Key {editing && <span className="text-ink-tertiary font-normal">（留空保留原值）</span>}
                  </label>
                  <input
                    type="password"
                    value={form.api_key ?? ""}
                    onChange={(e) => setForm({ ...form, api_key: e.target.value })}
                    placeholder={editing ? "••••••••（未修改）" : "sk-..."}
                    className="w-full h-10 px-3 text-sm bg-surface border border-border rounded-lg focus:border-accent focus:ring-2 focus:ring-accent/15 outline-none text-ink placeholder:text-ink-tertiary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-ink mb-1.5">超时（秒）</label>
                  <input
                    type="number"
                    value={form.timeout ?? 180}
                    onChange={(e) => setForm({ ...form, timeout: Number(e.target.value) })}
                    min={1}
                    max={600}
                    className="w-full h-10 px-3 text-sm bg-surface border border-border rounded-lg focus:border-accent focus:ring-2 focus:ring-accent/15 outline-none text-ink"
                  />
                </div>
                <div className="flex flex-col justify-end">
                  <label className="flex items-center gap-2.5 mb-3.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.is_default ?? false}
                      onChange={(e) => setForm({ ...form, is_default: e.target.checked })}
                      className="w-4 h-4 rounded border-border text-accent focus:ring-accent"
                    />
                    <span className="text-sm text-ink">设为默认模型</span>
                  </label>
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.is_enabled ?? true}
                      onChange={(e) => setForm({ ...form, is_enabled: e.target.checked })}
                      className="w-4 h-4 rounded border-border text-accent focus:ring-accent"
                    />
                    <span className="text-sm text-ink">启用（对用户可选）</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border">
              <Button variant="secondary" onClick={() => setShowForm(false)}>
                取消
              </Button>
              <Button onClick={save} disabled={saving}>
                {saving ? (
                  <>
                    <LoaderIcon className="w-4 h-4 animate-spin" />
                    保存中...
                  </>
                ) : (
                  "保存"
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
