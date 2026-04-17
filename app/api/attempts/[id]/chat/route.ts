import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * @swagger
 * /api/attempts/{id}/chat:
 *   get:
 *     summary: Get chat history for an attempt
 *     description: Returns all persisted chat messages for an attempt in chronological order.
 *     tags:
 *       - Chat
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Chat history loaded
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AttemptChatHistoryResponse'
 *       404:
 *         description: Attempt not found
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
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    const { data: attempt, error: attemptError } = await supabaseAdmin
      .from("attempts")
      .select("id")
      .eq("id", id)
      .single();

    if (attemptError || !attempt) {
      return NextResponse.json({ error: "Attempt not found" }, { status: 404 });
    }

    const { data, error } = await supabaseAdmin
      .from("chat_messages")
      .select(
        "id, attempt_id, prompt_index, role, content, task_title, task_description, task_guidance, created_at"
      )
      .eq("attempt_id", id)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Failed to load chat history:", error);
      return NextResponse.json({ error: "Failed to load chat history" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      attempt_id: id,
      messages: data || [],
    });
  } catch (error) {
    console.error("Attempt chat GET error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}