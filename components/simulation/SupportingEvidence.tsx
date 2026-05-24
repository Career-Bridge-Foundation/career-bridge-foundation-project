"use client";

import { useState, useRef } from "react";
import type { EvidenceFile } from "@/hooks/useSimulation";

const ACCEPTED_MIME_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "text/csv",
  "application/csv",
];

interface SupportingEvidenceProps {
  uploadedFiles: EvidenceFile[];
  onFileSelect: (file: File) => Promise<void>;
  onFileRemove: (filePath: string) => void;
  uploading?: boolean;
  uploadError?: string | null;
}

export function SupportingEvidence({
  uploadedFiles,
  onFileSelect,
  onFileRemove,
  uploading = false,
  uploadError,
}: SupportingEvidenceProps) {
  const [fileError, setFileError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFiles(incoming: File[]) {
    setFileError("");
    if (uploadedFiles.length + incoming.length > 3) {
      setFileError("Maximum 3 files allowed.");
      return;
    }
    for (const f of incoming) {
      if (!ACCEPTED_MIME_TYPES.includes(f.type)) {
        setFileError(`"${f.name}" is not an accepted file type.`);
        return;
      }
      if (f.size > 10 * 1024 * 1024) {
        setFileError(`"${f.name}" exceeds the 10 MB limit.`);
        return;
      }
    }
    for (const f of incoming) {
      await onFileSelect(f);
    }
  }

  return (
    <div className="mb-8">
      <div className="flex items-baseline gap-2 mb-4">
        <span
          className="text-xs font-semibold uppercase text-navy tracking-brand-sm"
          style={{ fontSize: "11px" }}
        >
          Supporting Evidence
        </span>
        <span className="text-xs text-[#aaa]">(optional)</span>
      </div>

      <div
        className="mb-4"
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          void handleFiles(Array.from(e.dataTransfer.files));
        }}
      >
        <div
          onClick={() => !uploading && fileInputRef.current?.click()}
          className={`flex flex-col items-center justify-center py-8 px-6 transition-colors border-2 border-dashed ${
            uploading
              ? "cursor-wait opacity-70 border-border-light bg-white"
              : dragOver
                ? "cursor-pointer border-teal bg-teal/[0.04]"
                : "cursor-pointer border-border-light bg-white"
          }`}
        >
          {uploading ? (
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="mb-2 stroke-teal animate-spin"
            >
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
            </svg>
          ) : (
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={`mb-2 ${dragOver ? "stroke-teal" : "stroke-[#bbb]"}`}
            >
              <polyline points="16,16 12,12 8,16" />
              <line x1="12" y1="12" x2="12" y2="21" />
              <path d="M20.39,18.39A5,5,0,0,0,18,9h-1.26A8,8,0,1,0,3,16.3" />
            </svg>
          )}
          <p className="text-sm text-[#555]">
            {uploading ? (
              "Uploading…"
            ) : (
              <>
                Drag &amp; drop files here, or{" "}
                <span className="underline text-link-blue">browse</span>
              </>
            )}
          </p>
          {!uploading && (
            <p className="text-xs text-[#bbb] mt-1.5">
              PDF, PNG, JPG, WEBP, CSV — max 10MB each — up to 3 files
            </p>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          disabled={uploading}
          accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.csv"
          className="hidden"
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            e.target.value = "";
            if (files.length) void handleFiles(files);
          }}
        />
      </div>

      {fileError && <p className="text-xs text-[#e53e3e] mb-2">{fileError}</p>}
      {uploadError && (
        <p className="text-xs text-[#e53e3e] mb-2">{uploadError}</p>
      )}

      {uploadedFiles.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {uploadedFiles.map((f, i) => (
            <div
              key={f.filePath || i}
              className="flex items-center gap-2 px-3 py-1.5 text-xs bg-grey-bg text-navy"
            >
              <svg
                width="11"
                height="11"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <path d="M13,2H6A2,2,0,0,0,4,4V20a2,2,0,0,0,2,2H18a2,2,0,0,0,2-2V9Z" />
                <polyline points="13,2 13,9 20,9" />
              </svg>
              <span className="font-medium">{f.name}</span>
              <span className="text-[#aaa]">
                ({(f.size / 1024).toFixed(0)} KB)
              </span>
              {f.filePath && (
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 12 12"
                  fill="none"
                  className="text-teal"
                >
                  <polyline
                    points="2,6 5,9 10,3"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
              <button
                onClick={() => onFileRemove(f.filePath)}
                className="ml-1 font-bold text-[#bbb]"
                aria-label="Remove file"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
