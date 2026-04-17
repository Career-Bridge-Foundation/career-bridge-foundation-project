import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

const SUPPORTING_EVIDENCE_BUCKET = "supporting-evidence";
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const SIGNED_URL_EXPIRY_SECONDS = 60 * 60;

const ALLOWED_EVIDENCE_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "text/plain",
  "text/markdown",
  "image/png",
  "image/jpeg",
  "image/webp",
  "text/csv",
] as const;

type AttachmentInsertRow = {
  attempt_id: string;
  prompt_index: number;
  attachment_type: "file" | "url";
  file_name?: string | null;
  file_mime_type?: string | null;
  file_size_bytes?: number | null;
  storage_path?: string | null;
  external_url?: string | null;
  created_at?: string;
};

/**
 * @swagger
 * /api/attempts/{id}/attachments:
 *   post:
 *     summary: Add supporting evidence attachment
 *     description: Adds a supporting evidence file (multipart upload) or URL (JSON payload) scoped to a prompt index.
 *     tags:
 *       - Attempts
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [prompt_index, file]
 *             properties:
 *               prompt_index:
 *                 type: integer
 *               file:
 *                 type: string
 *                 format: binary
 *         application/json:
 *           schema:
 *             type: object
 *             required: [prompt_index, url]
 *             properties:
 *               prompt_index:
 *                 type: integer
 *               url:
 *                 type: string
 *                 format: uri
 *     responses:
 *       200:
 *         description: Attachment saved
 *       400:
 *         description: Invalid payload
 *       404:
 *         description: Attempt not found
 *       500:
 *         description: Server error
 */
export async function POST(
  request: NextRequest,
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

    const contentType = request.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      return await handleFileUpload(request, id);
    }

    return await handleUrlAttachment(request, id);
  } catch (error) {
    console.error("Attachment POST error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

async function handleFileUpload(request: NextRequest, attemptId: string) {
  const formData = await request.formData();

  const promptIndexRaw = formData.get("prompt_index");
  const promptIndex = Number(promptIndexRaw);

  if (!Number.isInteger(promptIndex) || promptIndex < 1) {
    return NextResponse.json(
      { error: "prompt_index must be a positive integer" },
      { status: 400 }
    );
  }

  const limitError = await validateAttachmentLimit(attemptId, promptIndex);
  if (limitError) {
    return NextResponse.json({ error: limitError }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }

  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json(
      { error: "File exceeds 10MB limit" },
      { status: 400 }
    );
  }

  if (!ALLOWED_EVIDENCE_MIME_TYPES.includes(file.type as (typeof ALLOWED_EVIDENCE_MIME_TYPES)[number])) {
    return NextResponse.json(
      { error: "Unsupported file type for supporting evidence" },
      { status: 400 }
    );
  }

  const fileExt = file.name.includes(".") ? file.name.split(".").pop() : "bin";
  const storagePath = `${attemptId}/prompt-${promptIndex}/${crypto.randomUUID()}.${fileExt}`;

  const uploadResult = await supabaseAdmin.storage
    .from(SUPPORTING_EVIDENCE_BUCKET)
    .upload(storagePath, file, {
      upsert: false,
      contentType: file.type,
    });

  if (uploadResult.error) {
    console.error("Supporting evidence upload error:", uploadResult.error);
    return NextResponse.json(
      { error: "Failed to upload supporting evidence" },
      { status: 500 }
    );
  }

  const insertRow: AttachmentInsertRow = {
    attempt_id: attemptId,
    prompt_index: promptIndex,
    attachment_type: "file",
    file_name: file.name,
    file_mime_type: file.type,
    file_size_bytes: file.size,
    storage_path: storagePath,
    external_url: null,
  };

  const { data, error } = await supabaseAdmin
    .from("attempt_attachments")
    .insert(insertRow)
    .select("*")
    .single();

  if (error || !data) {
    await supabaseAdmin.storage.from(SUPPORTING_EVIDENCE_BUCKET).remove([storagePath]);
    console.error("Attachment insert error:", error);
    return NextResponse.json(
      { error: "Failed to save attachment metadata" },
      { status: 500 }
    );
  }

  const signedUrlResult = await supabaseAdmin.storage
    .from(SUPPORTING_EVIDENCE_BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_EXPIRY_SECONDS);

  return NextResponse.json({
    success: true,
    attachment: data,
    signed_url: signedUrlResult.data?.signedUrl || null,
  });
}

async function handleUrlAttachment(request: NextRequest, attemptId: string) {
  const body = (await request.json()) as { prompt_index?: number; url?: string };

  const promptIndex = Number(body.prompt_index);
  if (!Number.isInteger(promptIndex) || promptIndex < 1) {
    return NextResponse.json(
      { error: "prompt_index must be a positive integer" },
      { status: 400 }
    );
  }

  const limitError = await validateAttachmentLimit(attemptId, promptIndex);
  if (limitError) {
    return NextResponse.json({ error: limitError }, { status: 400 });
  }

  const rawUrl = (body.url || "").trim();
  if (!rawUrl) {
    return NextResponse.json({ error: "url is required" }, { status: 400 });
  }

  let normalizedUrl = "";
  try {
    normalizedUrl = new URL(rawUrl).toString();
  } catch {
    return NextResponse.json({ error: "Invalid URL format" }, { status: 400 });
  }

  const insertRow: AttachmentInsertRow = {
    attempt_id: attemptId,
    prompt_index: promptIndex,
    attachment_type: "url",
    external_url: normalizedUrl,
    file_name: null,
    file_mime_type: null,
    file_size_bytes: null,
    storage_path: null,
  };

  const { data, error } = await supabaseAdmin
    .from("attempt_attachments")
    .insert(insertRow)
    .select("*")
    .single();

  if (error || !data) {
    console.error("URL attachment insert error:", error);
    return NextResponse.json(
      { error: "Failed to save URL attachment" },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, attachment: data });
}

async function validateAttachmentLimit(
  attemptId: string,
  promptIndex: number
): Promise<string | null> {
  const { count, error } = await supabaseAdmin
    .from("attempt_attachments")
    .select("id", { count: "exact", head: true })
    .eq("attempt_id", attemptId)
    .eq("prompt_index", promptIndex);

  if (error) {
    console.error("Failed checking attachment count:", error);
    return "Unable to validate attachment limit right now";
  }

  if ((count || 0) >= 3) {
    return "You can upload up to 3 supporting evidence items per prompt";
  }

  return null;
}
