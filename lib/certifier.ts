export async function claimCredential(
  sessionId: string
): Promise<{ credentialUrl: string; imageUrl: string | null }> {
  const res = await fetch("/api/certifier/issue", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: "Unknown error" }));
    throw new Error((body as { error?: string }).error ?? "Failed to issue credential");
  }
  const data = (await res.json()) as { credentialUrl: string; imageUrl?: string | null };
  return { credentialUrl: data.credentialUrl, imageUrl: data.imageUrl ?? null };
}
