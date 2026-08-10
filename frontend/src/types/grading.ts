export interface ProviderRef {
  id: string;
  name: string;
  type: string;
  model: string;
}

export interface ScoreDetail {
  item: string;
  fullScore: number;
  actualScore: number;
  description: string;
}

export interface ModelResult {
  provider: ProviderRef;
  status: "success" | "error";
  score?: number;
  feedback?: string;
  suggestions?: string[];
  scoreDetails?: ScoreDetail[];
  message?: string;
}

export interface Aggregate {
  hasScore?: boolean;
  avgScore?: number;
  maxScore?: number;
  minScore?: number;
  stdDev?: number;
  diff?: number;
  count?: number;
  rankings?: { providerId: string; name: string; score: number }[];
}

export interface ModelsStartedEvent {
  type: "models_started";
  providerIds: string[];
  providers: ProviderRef[];
  questionType?: string;
  questionTypeSource?: string;
  invalidIds?: string[];
}

export interface ModelResultEvent {
  type: "model_result";
  provider: ProviderRef;
  status: "success";
  score: number;
  feedback: string;
  suggestions: string[];
  scoreDetails?: ScoreDetail[];
}

export interface ModelErrorEvent {
  type: "model_error";
  provider: ProviderRef;
  status: "error";
  message: string;
}

export interface DoneEvent {
  type: "done";
  results: ModelResult[];
  aggregate: Aggregate;
}
