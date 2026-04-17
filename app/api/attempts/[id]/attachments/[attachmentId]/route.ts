import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

const SUPPORTING_EVIDENCE_BUCKET = "supporting-evidence";

/**
 * @swagger
 * /api/attempts/{id}/attachments/{attachmentId}:
 *   delete:
 *     summary: Delete supporting evidence attachment
 *     description: Deletes a supporting evidence attachment and removes file storage object if applicable.
 *     tags:
 *       - Attempts
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: attachmentId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Attachment deleted
 *       404:
 *         description: Attachment not found
 *       500:
 *         description: Server error
 */
export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string; attachmentId: string }> }
) {
  try {
    const { id, attachmentId } = await context.params;

    const { data: attachment, error: fetchError } = await supabaseAdmin
      .from("attempt_attachments")
      .select("id, attempt_id, storage_path")
      .eq("id", attachmentId)
      .eq("attempt_id", id)
      .single();

    if (fetchError || !attachment) {
      return NextResponse.json({ error: "Attachment not found" }, { status: 404 });
    }

    if (attachment.storage_path) {
      const storageDelete = await supabaseAdmin.storage
        .from(SUPPORTING_EVIDENCE_BUCKET)
        .remove([attachment.storage_path as string]);

      if (storageDelete.error) {
        console.error("Storage delete error:", storageDelete.error);
      }
    }

    const { error: deleteError } = await supabaseAdmin
      .from("attempt_attachments")
      .delete()
      .eq("id", attachmentId)
      .eq("attempt_id", id);

    if (deleteError) {
      console.error("Attachment delete error:", deleteError);
      return NextResponse.json({ error: "Failed to delete attachment" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Attachment DELETE error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
