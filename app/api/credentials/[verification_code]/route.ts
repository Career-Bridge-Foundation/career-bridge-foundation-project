import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * @swagger
 * /api/credentials/{verification_code}:
 *   get:
 *     summary: Verify credential by code
 *     description: Public endpoint for verifying a credential from a shareable verification code.
 *     tags:
 *       - Credentials
 *     parameters:
 *       - in: path
 *         name: verification_code
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Credential verification result
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CredentialVerificationResponse'
 *       404:
 *         description: Credential not found
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
  context: { params: Promise<{ verification_code: string }> }
) {
  try {
    const { verification_code } = await context.params;
    const code = verification_code.trim();

    if (!code) {
      return NextResponse.json({ error: "verification_code is required" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("credentials")
      .select(
        "verification_code, candidate_name, discipline, credential_title, issued_at, expires_at, status, certifier_credential_id, metadata"
      )
      .eq("verification_code", code)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: "Credential not found" }, { status: 404 });
    }

    const now = Date.now();
    const expiresAtMs = data.expires_at ? new Date(String(data.expires_at)).getTime() : null;
    const isExpired = typeof expiresAtMs === "number" && Number.isFinite(expiresAtMs)
      ? expiresAtMs < now
      : false;

    const isVerified = String(data.status || "active") === "active" && !isExpired;

    return NextResponse.json({
      verified: isVerified,
      credential: {
        verification_code: data.verification_code,
        candidate_name: data.candidate_name,
        discipline: data.discipline,
        credential_title: data.credential_title,
        issued_at: data.issued_at,
        expires_at: data.expires_at,
        status: data.status,
        certifier_credential_id: data.certifier_credential_id,
        metadata: data.metadata,
      },
    });
  } catch (error) {
    console.error("Credential verification error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
