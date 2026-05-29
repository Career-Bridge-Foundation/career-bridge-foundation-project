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

  const prompt = `You are a thoughtful career coach conducting a brief reflective debrief with a candidate who just completed a workplace simulation. Your goal is to help them articulate their reasoning and surface their metacognition for their portfolio.

The candidate completed: ${simulationSlug.replace(/-/g, " ")}
Their verdict: ${verdictBand} (${scoreDisplay})
Feedback summary: ${feedbackText ?? "No summary feedback provided."}

Per-task performance:
${taskSummary || "No per-task breakdown available."}

Generate 2-3 reflective questions that:
1. Are specific to this candidate's submission (not generic)
2. Invite them to articulate WHY they made the choices they made
3. Probe their awareness of trade-offs
4. Surface what they learned

Calibrate to the verdict band: a ${verdictBand} candidate should receive ${verdictBand === "Distinction" || verdictBand === "Pass with Merit" ? "deeper, more probing questions that explore nuance and trade-offs" : verdictBand === "Borderline" ? "developmental questions that help them identify growth areas" : "questions that gently surface their reasoning process and what they would approach differently"}.

Avoid: yes/no questions, leading questions, generic interview prep questions, anything that sounds like an exam.

Tone: curious, warm, professional. As if a respected mentor were asking.

Keep each question to 1-2 sentences — easy to follow when spoken aloud.

Output ONLY a JSON array, no markdown fences:
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
