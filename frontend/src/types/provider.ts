export interface AiProvider {
  id: string;
  name: string;
  provider_type: string;
  base_url?: string | null;
  model: string;
  is_default: boolean;
  is_enabled: boolean;
  timeout: number;
  api_key_masked?: string;
  extra?: Record<string, unknown> | null;
  created_at?: string;
  updated_at?: string;
}

export interface ProviderPayload {
  name: string;
  provider_type: string;
  base_url?: string | null;
  api_key?: string;
  model: string;
  is_default?: boolean;
  is_enabled?: boolean;
  timeout?: number;
}

export interface ProviderTestResult {
  ok: boolean;
  message: string;
  latency_ms?: number | null;
}
