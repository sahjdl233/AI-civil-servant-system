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

/* ---------- 双角色批改类型 ---------- */

export interface DualRoleRef {
  key: "grader" | "coach";
  name: string;
}

export interface ScoreBreakdownItem {
  item: string;
  full_score: number;
  actual_score: number;
}

export interface MainDeduction {
  reason: string;
  deducted?: number;
}

export interface GraderResult {
  total_score: number;
  score_breakdown: ScoreBreakdownItem[];
  main_deductions: MainDeduction[];
  scoring_basis: string;
}

export interface RewriteItem {
  original: string;
  optimized: string;
  why: string;
}

export interface ParagraphAdvice {
  paragraph: string;
  diagnosis: string;
  suggestions: string[];
  rewrites: RewriteItem[];
}

export interface CoachResult {
  paragraph_advice: ParagraphAdvice[];
  overall_advice: string;
}

export interface StandardAnswerResult {
  standardAnswer: string;
  explanation: string;
}

export interface DualRolePart1 {
  score: number;
  mainDeductions: string[];
  scoringBasis: string;
}

export interface DualRolePart2 {
  paragraphAdvice: ParagraphAdvice[];
  overallAdvice: string;
}

export interface CombinedDualResult {
  part1: DualRolePart1 | null;
  part2: DualRolePart2 | null;
}

export interface DualRolesStartedEvent {
  type: "roles_started";
  roles: DualRoleRef[];
  questionType?: string;
  questionTypeSource?: string;
}

export interface DualRoleResultEvent {
  type: "role_result";
  role: "grader" | "coach";
  data: GraderResult | CoachResult;
}

export interface DualRoleErrorEvent {
  type: "role_error";
  role: "grader" | "coach";
  message: string;
}

export interface DualDoneEvent {
  type: "done";
  grader?: GraderResult | null;
  coach?: CoachResult | null;
  combined?: CombinedDualResult;
  questionType?: string;
  questionTypeSource?: string;
}
