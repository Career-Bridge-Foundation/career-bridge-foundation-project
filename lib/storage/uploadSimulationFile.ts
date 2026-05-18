import { createClient } from "@/lib/supabase/client";

const BUCKET = "simulation-submissions";
const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "text/csv",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
]);

export class UploadValidationError extends Error {}

export function validateSimulationFile(file: File): void {
  if (file.size > MAX_SIZE_BYTES) {
    throw new UploadValidationError(
      `File exceeds the 10 MB limit (${(file.size / 1024 / 1024).toFixed(1)} MB)`
    );
  }
  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    throw new UploadValidationError(
      `File type "${file.type || file.name.split(".").pop()}" is not allowed. ` +
        "Upload a PDF, Word document, image, spreadsheet, or CSV."
    );
  }
}

export async function uploadSimulationFile(
  file: File,
  userId: string,
  sessionId: string,
  taskId: number
): Promise<string> {
  validateSimulationFile(file);

  const supabase = createClient();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${userId}/${sessionId}/${taskId}/${Date.now()}_${safeName}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type });

  if (error) throw new Error(`Upload failed: ${error.message}`);

  return path;
}

export async function getSimulationFileSignedUrl(
  path: string,
  expiresInSeconds = 3600
): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, expiresInSeconds);

  if (error || !data?.signedUrl) {
    throw new Error(`Could not generate signed URL: ${error?.message ?? "unknown"}`);
  }

  return data.signedUrl;
}
