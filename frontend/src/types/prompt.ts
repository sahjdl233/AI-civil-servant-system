export interface PromptTemplate {
  id: string;
  key: string;
  name: string;
  category: string;
  description?: string | null;
  is_active: boolean;
  published_version?: number | null;
  content: string;
  latest_version?: number | null;
  version_count: number;
  created_at?: string | null;
  updated_at?: string | null;
  draft_content?: string;
}

export interface PromptVersion {
  id: string;
  version: number;
  content: string;
  change_note?: string | null;
  is_published: boolean;
  created_at?: string | null;
}

export interface PromptPayload {
  key: string;
  name: string;
  category: string;
  description?: string;
  content: string;
  change_note?: string;
  publish?: boolean;
}

export interface VersionPayload {
  content: string;
  change_note?: string;
  publish?: boolean;
}

export interface DiffOp {
  op: "eq" | "add" | "del";
  line: string;
}

export interface DiffResult {
  version_a: number;
  version_b: number;
  ops: DiffOp[];
}
