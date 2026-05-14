// ── Canonical simulation + discipline types ──────────────

export type { Simulation, Discipline } from "./simulation";

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
