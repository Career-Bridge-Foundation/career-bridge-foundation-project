"use client";

import { cn } from "@/lib/cn";
import type { Prompt, StepResponse } from "@/types";

function countWords(text: string): number {
  return text.trim() === "" ? 0 : text.trim().split(/\s+/).length;
}

function isValidUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

interface ResponseFormProps {
  prompt: Prompt;
  response: StepResponse;
  onUpdate: (patch: Partial<StepResponse>) => void;
  onFileSelect?: (file: File) => Promise<void>;
  uploadError?: string | null;
  uploading?: boolean;
}

function EitherToggle({
  mode,
  onModeChange,
}: {
  mode: "typed" | "upload";
  onModeChange: (m: "typed" | "upload") => void;
}) {
  return (
    <div className="flex gap-2 mb-5">
      {(["typed", "upload"] as const).map((m) => (
        <button
          key={m}
          onClick={() => onModeChange(m)}
          className={cn(
            "text-xs font-medium uppercase px-4 py-2 border tracking-brand-xs",
            mode === m
              ? "border-navy bg-navy text-white"
              : "border-border-light bg-white text-[#888]"
          )}
        >
          {m === "typed" ? "Write Response" : "Upload Document"}
        </button>
      ))}
    </div>
  );
}

export function ResponseForm({
  prompt,
  response,
  onUpdate,
  onFileSelect,
  uploadError,
  uploading = false,
}: ResponseFormProps) {
  const mode = response.mode ?? "typed";
  const textValue = response.text ?? "";
  const rationaleValue = response.rationale ?? "";
  const urlValue = response.url ?? "";

  const wc = countWords(textValue);
  const rwc = countWords(rationaleValue);
  const wcMet = wc >= prompt.minWords;
  const rwcMet = rwc >= 100;

  const showTyped =
    prompt.type === "typed" || (prompt.type === "either" && mode === "typed");
  const showUpload =
    prompt.type === "upload" || (prompt.type === "either" && mode === "upload");
  const showUrl = prompt.type === "url";

  return (
    <>
      {/* TYPED */}
      {showTyped && (
        <div className="mb-8">
          {prompt.type === "either" && (
            <EitherToggle mode={mode} onModeChange={(m) => onUpdate({ mode: m })} />
          )}
          <span className="text-xs font-semibold uppercase text-[#888] tracking-brand-md block mb-1.5">
            Your Response
          </span>
          <p className="text-xs text-[#bbb] mb-3">
            Minimum {prompt.minWords} words. Write as you would in a real workplace context.
          </p>
          <textarea
            value={textValue}
            onChange={(e) => onUpdate({ text: e.target.value })}
            placeholder="Begin your response here..."
            className="sim-input w-full p-5 text-sm text-[#333] leading-[1.8] resize-none min-h-[220px]"
          />
          <p className={cn("mt-2 text-xs", wcMet ? "text-teal" : "text-[#bbb]")}>
            {wc} / {prompt.minWords} words minimum
          </p>
        </div>
      )}

      {/* UPLOAD */}
      {showUpload && (
        <div className="mb-8">
          {prompt.type === "either" && (
            <EitherToggle mode={mode} onModeChange={(m) => onUpdate({ mode: m })} />
          )}
          <span className="text-xs font-semibold uppercase text-[#888] tracking-brand-md block mb-3">
            Your Submission
          </span>
          {response.file ? (
            <div className="flex items-center justify-between p-4 border border-teal bg-teal/[0.04]">
              <span className="flex items-center gap-2 text-sm text-navy">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-teal">
                  <polyline points="20,6 9,17 4,12" />
                </svg>
                {response.file.name}
                <span className="text-xs text-[#aaa]">
                  ({(response.file.size / 1024).toFixed(0)} KB)
                </span>
                {response.file.filePath && (
                  <span className="text-xs text-teal">Uploaded</span>
                )}
              </span>
              <button
                onClick={() => onUpdate({ file: null })}
                className="text-xs text-[#aaa]"
                disabled={uploading}
              >
                Remove
              </button>
            </div>
          ) : (
            <label className={cn(
              "flex flex-col items-center justify-center p-12 border-2 border-dashed border-teal bg-teal/[0.02]",
              uploading ? "cursor-wait opacity-60" : "cursor-pointer"
            )}>
              {uploading ? (
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-teal animate-spin">
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                </svg>
              ) : (
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-teal">
                  <path d="M21,15v4a2,2,0,0,1-2,2H5a2,2,0,0,1-2-2v-4" />
                  <polyline points="17,8 12,3 7,8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
              )}
              <span className="text-sm font-medium text-navy mt-3 mb-1">
                {uploading ? "Uploading…" : "Drag and drop your file here"}
              </span>
              {!uploading && <span className="text-xs text-[#aaa] mb-4">or click to browse</span>}
              <input
                type="file"
                className="hidden"
                disabled={uploading}
                accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.gif,.webp,.csv,.xls,.xlsx,.ppt,.pptx"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (!file) return;
                  if (file.size > 10 * 1024 * 1024) return;
                  if (onFileSelect) {
                    await onFileSelect(file);
                  } else {
                    onUpdate({ file: { name: file.name, size: file.size } });
                  }
                }}
              />
              <span className="text-xs text-[#ccc]">
                PDF, Word, images, spreadsheets, CSV. Maximum 10 MB.
              </span>
            </label>
          )}
          {uploadError && (
            <p className="text-xs text-[#e53e3e] mt-2">{uploadError}</p>
          )}
        </div>
      )}

      {/* URL task — rationale only */}
      {showUrl && (
        <div className="mb-8">
          <span className="text-xs font-semibold uppercase text-[#888] tracking-brand-md block mb-1.5">
            Your Submission Rationale
          </span>
          <p className="text-xs text-[#bbb] mb-3">
            Explain your thinking and approach in 100 to 200 words.
          </p>
          <textarea
            value={rationaleValue}
            onChange={(e) => onUpdate({ rationale: e.target.value })}
            placeholder="Explain your strategic choices and approach..."
            className="sim-input w-full p-5 text-sm text-[#333] leading-[1.8] resize-none min-h-[160px]"
          />
          <p className={cn("mt-2 text-xs", rwcMet ? "text-teal" : "text-[#bbb]")}>
            {rwc} / 100 words minimum
          </p>
        </div>
      )}
    </>
  );
}
