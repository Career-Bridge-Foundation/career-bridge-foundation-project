import Anthropic from "@anthropic-ai/sdk";
import type { EvaluationTaskScore, VerdictBand, DebriefQuestion } from "@/types/database";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

interface GenerateQuestionsInput {
  simulationSlug: string;
  verdictBand: VerdictBand;
  overallScore: number | null;
  feedbackText: string | null;
  taskScores: EvaluationTaskScore[];
}

export async function generateDebriefQuestions(
  input: GenerateQuestionsInput
): Promise<DebriefQuestion[]> {
  const { simulationSlug, verdictBand, overallScore, feedbackText, taskScores } = input;

  const taskSummary = taskScores
    .map((t) => `- Task ${t.taskId} (${t.title}): ${t.score}/${t.maxScore} — ${t.summary}`)
    .join("\n");

  const scoreDisplay = overallScore != null ? `${overallScore}/100` : "not scored";

  const prompt = `You are preparing reflective debrief questions for a candidate who just completed a professional workplace simulation.

Simulation: ${simulationSlug.replace(/-/g, " ")}
Overall verdict: ${verdictBand} (${scoreDisplay})
Evaluator feedback: ${feedbackText ?? "No summary feedback provided."}

Per-task performance:
${taskSummary || "No per-task breakdown available."}

Generate 2-3 reflective questions for a voice debrief conversation. These questions will be asked aloud by an AI coach.

Requirements:
- Open-ended and conversational (not yes/no)
- Reference the candidate's actual performance without being judgmental
- Cover: their approach/reasoning, what they would do differently, and what they learned
- If performance was mixed or uneven across tasks, ask about the contrast
- Keep each question to 1-2 sentences — easy to follow when spoken aloud
- Do not repeat the same theme in two questions

Return ONLY a JSON array, no markdown fences:
[
  { "question": "...", "rationale": "..." },
  ...
]`;

  const message = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  });

  const block = message.content[0];
  if (!block || block.type !== "text") {
    throw new Error("Claude returned no text content for question generation");
  }

  const jsonStr = block.text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();

  return JSON.parse(jsonStr) as DebriefQuestion[];
}
