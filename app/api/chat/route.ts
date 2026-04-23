import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const ALLOWED_CORS_ORIGIN = process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? "";

function getCorsHeaders(origin: string | null): Record<string, string> {
  if (!origin || !ALLOWED_CORS_ORIGIN || origin !== ALLOWED_CORS_ORIGIN) {
    return {};
  }

  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
  };
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin && ALLOWED_CORS_ORIGIN && origin !== ALLOWED_CORS_ORIGIN) {
    return new Response(JSON.stringify({ error: "Origin not allowed" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json", ...getCorsHeaders(origin) },
    });
  }

  const rateLimit = checkRateLimit({
    key: `chat:${user.id}`,
    limit: 45,
    windowMs: 60_000,
  });

  if (!rateLimit.allowed) {
    return new Response(JSON.stringify({ error: "Too many chat requests" }), {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(rateLimit.retryAfterSeconds),
        ...getCorsHeaders(origin),
      },
    });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return new Response(JSON.stringify({ error: "Server configuration error" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...getCorsHeaders(origin) },
    });
  }

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
      ...getCorsHeaders(origin),
    },
  });
}

export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin && ALLOWED_CORS_ORIGIN && origin !== ALLOWED_CORS_ORIGIN) {
    return new Response(null, { status: 403 });
  }

  return new Response(null, {
    status: 204,
    headers: {
      ...getCorsHeaders(origin),
    },
  });
}
