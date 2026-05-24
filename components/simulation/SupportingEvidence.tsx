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

function isValidUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

interface SupportingEvidenceProps {
  taskId: number;
  uploadedFiles: EvidenceFile[];
  attachedUrls: string[];
  onFileSelect: (file: File) => Promise<void>;
  onFileRemove: (filePath: string) => void;
  onUrlAdd: (url: string) => void;
  onUrlRemove: (url: string) => void;
  uploading?: boolean;
  uploadError?: string | null;
}

export function SupportingEvidence({
  uploadedFiles,
  attachedUrls,
  onFileSelect,
  onFileRemove,
  onUrlAdd,
  onUrlRemove,
  uploading = false,
  uploadError,
}: SupportingEvidenceProps) {
  const [fileError, setFileError] = useState("");
  const [urlInput, setUrlInput] = useState("");
  const [urlError, setUrlError] = useState("");
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

  function addUrl() {
    const trimmed = urlInput.trim();
    if (!trimmed) return;
    if (!isValidUrl(trimmed)) {
      setUrlError("Please enter a valid URL starting with https://");
      return;
    }
    if (attachedUrls.includes(trimmed)) {
      setUrlError("This URL has already been added.");
      return;
    }
    onUrlAdd(trimmed);
    setUrlInput("");
    setUrlError("");
  }

  return (
    <div className="mb-8">
      {/* Section header */}
      <div className="flex items-baseline gap-2 mb-4">
        <span className="text-xs font-semibold uppercase text-navy tracking-brand-sm" style={{ fontSize: "11px" }}>
          Supporting Evidence
        </span>
        <span className="text-xs text-[#aaa]">(optional)</span>
      </div>

      {/* Drop zone */}
      <div
        className="mb-4"
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
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
              width="28" height="28" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
              className="mb-2 stroke-teal animate-spin"
            >
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
            </svg>
          ) : (
            <svg
              width="28" height="28" viewBox="0 0 24 24" fill="none"
              strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
              className={`mb-2 ${dragOver ? "stroke-teal" : "stroke-[#bbb]"}`}
            >
              <polyline points="16,16 12,12 8,16" />
              <line x1="12" y1="12" x2="12" y2="21" />
              <path d="M20.39,18.39A5,5,0,0,0,18,9h-1.26A8,8,0,1,0,3,16.3" />
            </svg>
          )}
          <p className="text-sm text-[#555]">
            {uploading ? "Uploading…" : (
              <>
                Drag &amp; drop files here, or{" "}
                <span className="underline text-link-blue">browse</span>
              </>
            )}
          </p>
          {!uploading && (
            <p className="text-xs text-[#bbb] mt-1.5">
              PDF, PNG, JPG, GIF, WEBP, CSV — max 10MB each — up to 3 files
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

      {/* Errors */}
      {fileError && <p className="text-xs text-[#e53e3e] mb-2">{fileError}</p>}
      {uploadError && <p className="text-xs text-[#e53e3e] mb-2">{uploadError}</p>}

      {/* File chips — show uploaded files with their persisted paths */}
      {uploadedFiles.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {uploadedFiles.map((f, i) => (
            <div key={f.filePath || i} className="flex items-center gap-2 px-3 py-1.5 text-xs bg-grey-bg text-navy">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M13,2H6A2,2,0,0,0,4,4V20a2,2,0,0,0,2,2H18a2,2,0,0,0,2-2V9Z" />
                <polyline points="13,2 13,9 20,9" />
              </svg>
              <span className="font-medium">{f.name}</span>
              <span className="text-[#aaa]">({(f.size / 1024).toFixed(0)} KB)</span>
              {f.filePath && (
                <svg width="10" height="10" viewBox="0 0 12 12" fill="none" className="text-teal">
                  <polyline points="2,6 5,9 10,3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
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

      {/* URL attachment */}
      <div>
        <div className="flex items-center gap-1.5 mb-2">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2" strokeLinecap="round">
            <path d="M10,13a5,5,0,0,0,7.54.54l3-3a5,5,0,0,0-7.07-7.07l-1.72,1.71" />
            <path d="M14,11a5,5,0,0,0-7.54-.54l-3,3a5,5,0,0,0,7.07,7.07l1.71-1.71" />
          </svg>
          <span className="text-xs font-medium text-[#888]">Attach a URL</span>
        </div>

        {/* Public link warning */}
        <div className="flex items-start gap-1.5 mb-2 px-2.5 py-2 bg-[#fffbeb] border border-[#f6d860]">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#b45309" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <p className="text-xs text-[#92400e] leading-snug">
            Links must be <strong>publicly accessible</strong>. Private or login-protected pages cannot be read. Upload the file directly instead.
          </p>
        </div>

        <div className="flex gap-2">
          <input
            type="url"
            value={urlInput}
            onChange={(e) => { setUrlInput(e.target.value); setUrlError(""); }}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); addUrl(); }
            }}
            placeholder="https://docs.google.com/..."
            className="sim-input flex-1 px-3 py-2 text-sm text-[#333]"
          />
          <button
            onClick={addUrl}
            className="px-4 py-2 text-xs font-medium text-white bg-link-blue shrink-0"
          >
            Add
          </button>
        </div>

        {urlError && <p className="text-xs text-[#e53e3e] mt-1">{urlError}</p>}

        {/* URL chips */}
        {attachedUrls.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {attachedUrls.map((url, i) => (
              <div
                key={i}
                className="flex items-center gap-2 px-3 py-1.5 text-xs bg-url-chip text-link-blue max-w-full"
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M10,13a5,5,0,0,0,7.54.54l3-3a5,5,0,0,0-7.07-7.07l-1.72,1.71" />
                  <path d="M14,11a5,5,0,0,0-7.54-.54l-3,3a5,5,0,0,0,7.07,7.07l1.71-1.71" />
                </svg>
                <span className="truncate max-w-[240px]">{url}</span>
                <button
                  onClick={() => onUrlRemove(url)}
                  className="ml-1 font-bold text-[#6aabce] shrink-0"
                  aria-label="Remove URL"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
