// ── Simulation list ──────────────────────────────────────

export interface Simulation {
  id: number;
  slug: string;
  title: string;
  company: string;
  industry: string;
  type: string;
  difficulty: "Foundation" | "Practitioner" | "Advanced";
  time: string;
  description: string;
}

// ── Disciplines ──────────────────────────────────────────

export interface Discipline {
  id: number;
  name: string;
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
  file?: { name: string; size: number } | null;
  url?: string;
  rationale?: string;
  mode?: "typed" | "upload";
}

// ── Chat ─────────────────────────────────────────────────

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}
