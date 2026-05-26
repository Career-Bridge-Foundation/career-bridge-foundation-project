import Anthropic from "@anthropic-ai/sdk";
import type { DebriefQuestion, DebriefSummary } from "@/types/database";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function generateDebriefSummary(
  transcript: string,
  questions: DebriefQuestion[]
): Promise<DebriefSummary> {
  const questionsText =
    questions.length > 0
      ? `\nThe candidate was asked these questions during the call:\n${questions
          .map((q, i) => `${i + 1}. ${q.question}`)
          .join("\n")}\n`
      : "";

  const prompt = `You are summarising a candidate's voice debrief conversation into structured written reflection.
${questionsText}
Here is the transcript of the voice conversation:

${transcript}

Extract what the candidate said and write a 3-part first-person summary:
1. approach — How they approached the simulation: what they did and why
2. would_do_differently — What they would change if they could do it again
3. what_learned — Key insights or skills they identified from the experience

Guidelines:
- Write entirely in first person ("I decided...", "I would...", "I learned...")
- 2-4 sentences per section
- Ground every sentence in what the candidate actually said — do not invent details
- If the candidate did not clearly address a section, write a brief honest placeholder (e.g., "I didn't get a chance to fully reflect on this during the debrief.")
- Write naturally, as the candidate would write it themselves

Return ONLY this JSON, no markdown fences:
{
  "approach": "...",
  "would_do_differently": "...",
  "what_learned": "..."
}`;

  const message = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  });

  const block = message.content[0];
  if (!block || block.type !== "text") {
    throw new Error("Claude returned no text content for summary generation");
  }

  const jsonStr = block.text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();

  return JSON.parse(jsonStr) as DebriefSummary;
}
