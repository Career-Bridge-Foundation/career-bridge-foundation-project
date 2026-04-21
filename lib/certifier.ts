export async function claimCredential(sessionId: string): Promise<string> {
  const res = await fetch("/api/certifier/issue", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: "Unknown error" }));
    throw new Error((body as { error?: string }).error ?? "Failed to issue credential");
  }
  const { credentialUrl } = (await res.json()) as { credentialUrl: string };
  return credentialUrl;
}
