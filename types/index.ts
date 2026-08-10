// ── Simulation list ──────────────────────────────────────

export interface Simulation {
  id: string | number;
  slug: string;
  title: string;
  company: string;
  industry: string;
  type: string;
  difficulty: "Foundation" | "Practitioner" | "Advanced";
  time: string;
  description: string;
  discipline?: string;
  /** UUID from the simulations table — used by AssessmentPackModal */
  simulation_uuid?: string;
  /** 'assessed' | 'practice' — gated by AssessmentPackModal if assessed */
  simulation_type?: string;
}

// ── Disciplines ──────────────────────────────────────────

export interface Discipline {
  id: number;
  name: string;
  slug: string;
  description: string;
  status: "available" | "coming-soon";
  count?: string;
  href?: string;
}

// ── Simulation execution ─────────────────────────────────

export type PromptType = "typed" | "upload" | "url" | "either";

export interface Prompt {
  id: number;
  type: PromptType;
  title: string;
  question: string;
  guidance: string[];
  minWords: number;
}

export interface StepResponse {
  text?: string;
  file?: { name: string; size: number; filePath?: string } | null;
  url?: string;
  rationale?: string;
  mode?: "typed" | "upload";
}

// ── Chat ─────────────────────────────────────────────────

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}
