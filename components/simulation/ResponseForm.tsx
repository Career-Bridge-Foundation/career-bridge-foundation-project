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

export function ResponseForm({ prompt, response, onUpdate }: ResponseFormProps) {
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
              </span>
              <button
                onClick={() => onUpdate({ file: null })}
                className="text-xs text-[#aaa]"
              >
                Remove
              </button>
            </div>
          ) : (
            <label className="flex flex-col items-center justify-center p-12 cursor-pointer border-2 border-dashed border-teal bg-teal/[0.02]">
              {/* Upload icon */}
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-teal">
                <path d="M21,15v4a2,2,0,0,1-2,2H5a2,2,0,0,1-2-2v-4" />
                <polyline points="17,8 12,3 7,8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              <span className="text-sm font-medium text-navy mt-3 mb-1">
                Drag and drop your file here
              </span>
              <span className="text-xs text-[#aaa] mb-4">or click to browse</span>
              <input
                type="file"
                className="hidden"
                accept=".pdf,.doc,.docx"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) onUpdate({ file: { name: file.name, size: file.size } });
                }}
              />
              <span className="text-xs text-[#ccc]">
                Accepted formats: PDF, Word. Maximum 10MB.
              </span>
            </label>
          )}
        </div>
      )}

      {/* URL */}
      {showUrl && (
        <div className="mb-8">
          <span className="text-xs font-semibold uppercase text-[#888] tracking-brand-md block mb-1.5">
            Your Submission
          </span>
          <input
            type="url"
            value={urlValue}
            onChange={(e) => onUpdate({ url: e.target.value })}
            placeholder="Paste your public link here e.g. Figma, Notion, Google Docs"
            className={cn(
              "sim-input w-full p-3.5 text-sm text-[#333] mb-1",
              urlValue && !isValidUrl(urlValue) ? "sim-input-error" : ""
            )}
          />
          {urlValue && !isValidUrl(urlValue) && (
            <p className="text-xs text-[#e53e3e] mb-1">
              Please enter a valid URL starting with https://
            </p>
          )}
          {urlValue && isValidUrl(urlValue) && (
            <p className="text-xs text-teal mb-1 flex items-center gap-1">
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                <polyline points="2,6 5,9 10,3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Valid URL
            </p>
          )}

          <div className="mt-6">
            <span className="text-xs font-semibold uppercase text-[#888] tracking-brand-md block mb-1.5">
              Rationale
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
        </div>
      )}
    </>
  );
}
