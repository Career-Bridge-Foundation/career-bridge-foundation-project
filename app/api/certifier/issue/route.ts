import { NextRequest } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

const QUALIFYING_BANDS = new Set(["Distinction", "Merit", "Pass"]);
const CERTIFIER_API_URL = "https://api.certifier.io/v1/credentials";
const CERTIFIER_API_VERSION = process.env.CERTIFIER_API_VERSION ?? "2022-10-26";

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createAdminClient(url, key, { auth: { persistSession: false } });
}

type CertifierCreateCredentialBody = {
  groupId: string;
  recipient: {
    name: string;
    email: string;
  };
  customAttributes?: Record<string, string>;
};

function getCustomAttributes(simulationId: string, verdictBand: string): Record<string, string> {
  const simulationTag = process.env.CERTIFIER_SIMULATION_ATTRIBUTE_TAG ?? "custom.simulation";
  const bandTag = process.env.CERTIFIER_BAND_ATTRIBUTE_TAG ?? "custom.band";

  return {
    [simulationTag]: simulationId,
    [bandTag]: verdictBand,
  };
}

export async function POST(request: NextRequest) {
  // ── 1. Auth ──────────────────────────────────────────────────
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── 2. Parse body ─────────────────────────────────────────────
  let sessionId: string;
  try {
    const body = await request.json();
    sessionId = body.sessionId;
    if (!sessionId) throw new Error("missing sessionId");
  } catch {
    return Response.json({ error: "sessionId is required" }, { status: 400 });
  }

  const admin = getAdminClient();

  // ── 3. Fetch evaluation result ────────────────────────────────
  const { data: evalRow, error: evalError } = await admin
    .from("evaluation_results")
    .select("verdict_band, simulation_slug, user_id")
    .eq("session_id", sessionId)
    .maybeSingle();

  if (evalError || !evalRow) {
    return Response.json({ error: "Evaluation result not found" }, { status: 404 });
  }

  if (evalRow.user_id !== user.id) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!QUALIFYING_BANDS.has(evalRow.verdict_band)) {
    return Response.json(
      { error: "Verdict does not qualify for a credential" },
      { status: 422 }
    );
  }

  const simulationId = evalRow.simulation_slug;

  // ── 4. Idempotency check ─────────────────────────────────────
  const { data: existing } = await admin
    .from("credential_issuances")
    .select("certifier_credential_url, status")
    .eq("candidate_user_id", user.id)
    .eq("simulation_id", simulationId)
    .maybeSingle();

  if (existing?.status === "issued" && existing.certifier_credential_url) {
    return Response.json({ credentialUrl: existing.certifier_credential_url });
  }

  // ── 5. Get recipient details ─────────────────────────────────
  const { data: authUser } = await admin.auth.admin.getUserById(user.id);
  const recipientEmail = authUser?.user?.email ?? "";

  const { data: profile } = await admin
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle();
  const recipientName = profile?.full_name ?? recipientEmail.split("@")[0];

  // ── 6. Call Certifier API ─────────────────────────────────────
  const certifierKey = process.env.CERTIFIER_API_KEY;
  const certifierGroup = process.env.CERTIFIER_GROUP_ID;

  if (!certifierKey || !certifierGroup) {
    console.error("[certifier/issue] Missing CERTIFIER_API_KEY or CERTIFIER_GROUP_ID");
    return Response.json({ error: "Server configuration error" }, { status: 500 });
  }

  let certifierCredentialId: string | null = null;
  let certifierCredentialUrl: string | null = null;

  try {
    const basePayload: CertifierCreateCredentialBody = {
      groupId: certifierGroup,
      recipient: { name: recipientName, email: recipientEmail },
      customAttributes: getCustomAttributes(simulationId, evalRow.verdict_band),
    };

    const callCertifier = async (payload: CertifierCreateCredentialBody): Promise<Response> => {
      const abort = new AbortController();
      const timer = setTimeout(() => abort.abort(), 20_000);

      try {
        return await fetch(CERTIFIER_API_URL, {
          method: "POST",
          signal: abort.signal,
          headers: {
            "Authorization": `Bearer ${certifierKey}`,
            "Certifier-Version": CERTIFIER_API_VERSION,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });
      } finally {
        clearTimeout(timer);
      }
    };

    let certRes: Response;
    try {
      certRes = await callCertifier(basePayload);
    } catch (firstErr) {
      const firstCode = (firstErr as { cause?: { code?: string } })?.cause?.code;
      const isConnectTimeout = firstCode === "UND_ERR_CONNECT_TIMEOUT";

      if (!isConnectTimeout) {
        throw firstErr;
      }

      // Retry once for transient network/connectivity failures.
      certRes = await callCertifier(basePayload);
    }

    if (!certRes.ok) {
      const errBody = await certRes.text();

      const hasCustomAttributesValidationError =
        certRes.status === 400 &&
        errBody.includes("validation_error") &&
        (
          errBody.includes("customAttributes") ||
          errBody.includes("Custom attribute [") ||
          errBody.includes("is not defined on the workspace level")
        );

      if (hasCustomAttributesValidationError) {
        console.warn(
          "[certifier/issue] Certifier rejected customAttributes; retrying without them:",
          certRes.status,
          errBody
        );

        const fallbackPayload: CertifierCreateCredentialBody = {
          groupId: certifierGroup,
          recipient: { name: recipientName, email: recipientEmail },
        };

        const fallbackRes = await callCertifier(fallbackPayload);
        if (!fallbackRes.ok) {
          const fallbackErrBody = await fallbackRes.text();
          console.error("[certifier/issue] Fallback Certifier API error:", fallbackRes.status, fallbackErrBody);
          throw new Error(`Certifier API returned ${fallbackRes.status}`);
        }

        const fallbackData = await fallbackRes.json() as {
          id?: string;
          url?: string;
          credential_url?: string;
        };
        console.log("[certifier/issue] Raw Certifier fallback response:", JSON.stringify(fallbackData, null, 2));

        certifierCredentialId = fallbackData.id ?? null;
        certifierCredentialUrl = fallbackData.url ?? fallbackData.credential_url ?? null;
      } else {
        console.error("[certifier/issue] Certifier API error:", certRes.status, errBody);
        throw new Error(`Certifier API returned ${certRes.status}`);
      }
    } else {
      const certData = await certRes.json() as {
        id?: string;
        url?: string;
        credential_url?: string;
      };
      console.log("[certifier/issue] Raw Certifier response:", JSON.stringify(certData, null, 2));
      certifierCredentialId = certData.id ?? null;
      certifierCredentialUrl = certData.url ?? certData.credential_url ?? null;
    }
  } catch (err) {
    console.error("[certifier/issue] Failed to call Certifier:", err);

    // Record the failure so we don't silently lose it
    await admin.from("credential_issuances").upsert(
      {
        candidate_user_id: user.id,
        simulation_id: simulationId,
        status: "failed",
      },
      { onConflict: "candidate_user_id,simulation_id" }
    );

    return Response.json({ error: "Credential issuance failed — please try again" }, { status: 502 });
  }

  // ── 7. Persist issuance ───────────────────────────────────────
  await admin.from("credential_issuances").upsert(
    {
      candidate_user_id: user.id,
      simulation_id: simulationId,
      certifier_credential_id: certifierCredentialId,
      certifier_credential_url: certifierCredentialUrl,
      status: "issued",
    },
    { onConflict: "candidate_user_id,simulation_id" }
  );

  return Response.json({ credentialUrl: certifierCredentialUrl });
}
