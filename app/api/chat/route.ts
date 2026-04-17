import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

const CLAUDE_MODEL = "claude-sonnet-4-20250514";
const CLAUDE_TIMEOUT_MS = 60000;
const MAX_TOKENS = 1000;
const TEMPERATURE = 0.3;

const MAX_MESSAGES_PER_MINUTE = 8;
const MAX_MESSAGES_PER_DAY = 120;

const CHAT_SYSTEM_PROMPT = [
  "You are a product management interview coach for Career Bridge.",
  "Your role is to coach, not complete tasks for the candidate.",
  "Never write full final answers, completed deliverables, or copy-paste-ready submissions for them.",
  "If asked for a direct answer, refuse briefly and switch to coaching with questions, frameworks, and next steps.",
  "Keep responses concise, practical, and grounded in the provided task context.",
  "Prefer prompting the candidate to think, then offer structured guidance and examples of process, not finished work.",
].join(" ");

type ChatRequestBody = {
  message?: string;
  taskTitle?: string;
  taskDescription?: string;
  taskGuidance?: string;
  attempt_id?: string;
  prompt_index?: number;
};

type MessageStreamDelta = {
  type?: string;
  delta?: {
    type?: string;
    text?: string;
  };
  error?: {
    message?: string;
  };
};

/**
 * @swagger
 * /api/chat:
 *   post:
 *     summary: Stream coaching chat response
 *     description: Streams Claude coaching feedback for a prompt using Server-Sent Events and persists both user and assistant messages.
 *     tags:
 *       - Chat
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ChatRequest'
 *     responses:
 *       200:
 *         description: SSE stream of coaching tokens
 *         content:
 *           text/event-stream:
 *             schema:
 *               type: string
 *               example: |
 *                 data: {"type":"start"}
 *
 *                 data: {"type":"delta","text":"Start by clarifying your assumptions..."}
 *
 *                 data: {"type":"done"}
 *
 *       400:
 *         description: Invalid payload
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       429:
 *         description: User is rate-limited
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ChatRequestBody;
    const message = body.message?.trim() || "";
    const taskTitle = body.taskTitle?.trim() || "";
    const taskDescription = body.taskDescription?.trim() || "";
    const taskGuidance = body.taskGuidance?.trim() || "";
    const attemptId = body.attempt_id?.trim() || "";
    const promptIndex = Number(body.prompt_index);

    if (!message || !attemptId || Number.isNaN(promptIndex)) {
      return NextResponse.json(
        { error: "message, attempt_id, and prompt_index are required" },
        { status: 400 }
      );
    }

    const { data: attempt, error: attemptError } = await supabaseAdmin
      .from("attempts")
      .select("id, candidate_email")
      .eq("id", attemptId)
      .single();

    if (attemptError || !attempt) {
      return NextResponse.json({ error: "Attempt not found" }, { status: 404 });
    }

    const userIdentifier =
      (attempt.candidate_email as string | null)?.toLowerCase().trim() ||
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      "unknown";

    const limitCheck = await checkRateLimit(userIdentifier);
    if (!limitCheck.allowed) {
      return NextResponse.json(
        { error: limitCheck.message || "Rate limit exceeded" },
        { status: 429 }
      );
    }

    const { error: userInsertError } = await supabaseAdmin.from("chat_messages").insert({
      attempt_id: attemptId,
      prompt_index: promptIndex,
      role: "user",
      content: message,
      task_title: taskTitle || null,
      task_description: taskDescription || null,
      task_guidance: taskGuidance || null,
      user_identifier: userIdentifier,
    });

    if (userInsertError) {
      console.error("Failed to persist user chat message:", userInsertError);
      return NextResponse.json({ error: "Failed to save chat message" }, { status: 500 });
    }

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        let assistantText = "";
        const emit = (payload: Record<string, unknown>) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
        };

        const apiKey = process.env.ANTHROPIC_API_KEY;
        if (!apiKey) {
          emit({ type: "error", message: "ANTHROPIC_API_KEY is not configured" });
          controller.close();
          return;
        }

        const controllerAbort = new AbortController();
        const timeoutId = setTimeout(() => controllerAbort.abort(), CLAUDE_TIMEOUT_MS);

        try {
          emit({ type: "start" });

          const userContent = [
            `Task title: ${taskTitle || "N/A"}`,
            `Task description: ${taskDescription || "N/A"}`,
            `Task guidance: ${taskGuidance || "N/A"}`,
            `Prompt index: ${promptIndex}`,
            "Candidate message:",
            message,
          ].join("\n\n");

          const claudeResponse = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "x-api-key": apiKey,
              "anthropic-version": "2023-06-01",
            },
            body: JSON.stringify({
              model: CLAUDE_MODEL,
              system: CHAT_SYSTEM_PROMPT,
              max_tokens: MAX_TOKENS,
              temperature: TEMPERATURE,
              stream: true,
              messages: [
                {
                  role: "user",
                  content: userContent,
                },
              ],
            }),
            signal: controllerAbort.signal,
          });

          if (!claudeResponse.ok) {
            const errorBody = await claudeResponse.text();
            throw new Error(`Claude API call failed: ${claudeResponse.status} ${errorBody}`);
          }

          if (!claudeResponse.body) {
            throw new Error("Claude API returned no stream body");
          }

          const reader = claudeResponse.body.getReader();
          let buffer = "";

          const consumeEvent = (rawEvent: string) => {
            const lines = rawEvent.split("\n");
            const dataLines = lines
              .filter((line) => line.startsWith("data:"))
              .map((line) => line.slice(5).trimStart());

            if (dataLines.length === 0) {
              return;
            }

            const payloadRaw = dataLines.join("\n");
            if (!payloadRaw || payloadRaw === "[DONE]") {
              return;
            }

            let parsed: MessageStreamDelta;
            try {
              parsed = JSON.parse(payloadRaw) as MessageStreamDelta;
            } catch {
              return;
            }

            if (parsed.type === "error") {
              throw new Error(parsed.error?.message || "Claude streaming error");
            }

            if (
              parsed.type === "content_block_delta" &&
              parsed.delta?.type === "text_delta" &&
              parsed.delta.text
            ) {
              assistantText += parsed.delta.text;
              emit({ type: "delta", text: parsed.delta.text });
            }
          };

          while (true) {
            const { value, done } = await reader.read();
            if (done) {
              break;
            }

            buffer += decoder.decode(value, { stream: true });

            let delimiterIndex = buffer.indexOf("\n\n");
            while (delimiterIndex !== -1) {
              const rawEvent = buffer.slice(0, delimiterIndex);
              buffer = buffer.slice(delimiterIndex + 2);
              consumeEvent(rawEvent);
              delimiterIndex = buffer.indexOf("\n\n");
            }
          }

          const tail = buffer.trim();
          if (tail) {
            consumeEvent(tail);
          }

          const trimmedAssistantText = assistantText.trim();
          if (!trimmedAssistantText) {
            throw new Error("Claude returned an empty assistant response");
          }

          const { error: assistantInsertError } = await supabaseAdmin
            .from("chat_messages")
            .insert({
              attempt_id: attemptId,
              prompt_index: promptIndex,
              role: "assistant",
              content: trimmedAssistantText,
              task_title: taskTitle || null,
              task_description: taskDescription || null,
              task_guidance: taskGuidance || null,
              user_identifier: userIdentifier,
            });

          if (assistantInsertError) {
            throw new Error(`Failed to save assistant message: ${assistantInsertError.message}`);
          }

          emit({ type: "done" });
        } catch (error) {
          const messageText =
            error instanceof Error ? error.message : "Chat generation failed unexpectedly";
          console.error("Chat stream error:", error);
          emit({ type: "error", message: messageText });
        } finally {
          clearTimeout(timeoutId);
          controller.close();
        }
      },
    });

    return new Response(stream, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Chat route error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

async function checkRateLimit(
  userIdentifier: string
): Promise<{ allowed: boolean; message?: string }> {
  const oneMinuteAgo = new Date(Date.now() - 60 * 1000).toISOString();
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const [{ count: minuteCount, error: minuteError }, { count: dayCount, error: dayError }] =
    await Promise.all([
      supabaseAdmin
        .from("chat_messages")
        .select("id", { count: "exact", head: true })
        .eq("user_identifier", userIdentifier)
        .eq("role", "user")
        .gte("created_at", oneMinuteAgo),
      supabaseAdmin
        .from("chat_messages")
        .select("id", { count: "exact", head: true })
        .eq("user_identifier", userIdentifier)
        .eq("role", "user")
        .gte("created_at", oneDayAgo),
    ]);

  if (minuteError || dayError) {
    const message = minuteError?.message || dayError?.message || "Unknown rate limit error";
    console.error("Rate limit check failed:", message);
    return { allowed: false, message: "Unable to verify rate limit right now" };
  }

  if ((minuteCount || 0) >= MAX_MESSAGES_PER_MINUTE) {
    return {
      allowed: false,
      message: "Too many chat messages. Please wait a minute and try again.",
    };
  }

  if ((dayCount || 0) >= MAX_MESSAGES_PER_DAY) {
    return {
      allowed: false,
      message: "Daily chat limit reached. Please continue tomorrow.",
    };
  }

  return { allowed: true };
}
