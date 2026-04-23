import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(request: NextRequest) {
  let body: {
    messages?: { role: "user" | "assistant"; content: string }[];
    taskTitle?: string;
    taskDescription?: string;
    taskGuidance?: string[];
  };

  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { messages, taskTitle, taskDescription = "", taskGuidance = [] } = body;

  if (!messages || messages.length === 0 || !taskTitle) {
    return new Response(
      JSON.stringify({ error: "Missing required fields: messages and taskTitle" }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  const systemPrompt = `You are a simulation coaching assistant for Career Bridge Portfolio Simulations. You help candidates work through workplace simulation tasks. Your role is to guide, not give answers.

The candidate is currently working on a task called: ${taskTitle}

Task description: ${taskDescription}

Task guidance points:
${taskGuidance.join("\n")}

Rules:
- Never write the answer for the candidate
- Ask guiding questions to help them think through the problem
- Reference the task guidance points when relevant
- Keep responses concise (2-3 sentences max)
- Be encouraging but professional
- If they ask you to write their response, politely decline and offer a guiding question instead`;

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const anthropicStream = client.messages.stream({
          model: "claude-opus-4-7",
          max_tokens: 1024,
          system: systemPrompt,
          messages,
        });

        for await (const chunk of anthropicStream) {
          if (
            chunk.type === "content_block_delta" &&
            chunk.delta.type === "text_delta"
          ) {
            controller.enqueue(encoder.encode(chunk.delta.text));
          }
        }

        controller.close();
      } catch (err) {
        controller.error(err);
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Transfer-Encoding": "chunked",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
