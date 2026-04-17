"use client";

import { useState, useRef } from "react";

const ACCEPTED_MIME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "image/png",
  "image/jpeg",
  "text/csv",
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
  uploadedFiles: File[];
  attachedUrls: string[];
  onFilesChange: React.Dispatch<React.SetStateAction<File[]>>;
  onUrlsChange: React.Dispatch<React.SetStateAction<string[]>>;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
}

export function SupportingEvidence({
  uploadedFiles,
  attachedUrls,
  onFilesChange,
  onUrlsChange,
  fileInputRef,
}: SupportingEvidenceProps) {
  const [fileError, setFileError] = useState("");
  const [urlInput, setUrlInput] = useState("");
  const [urlError, setUrlError] = useState("");
  const [dragOver, setDragOver] = useState(false);

  function handleFiles(incoming: File[]) {
    setFileError("");
    const combined = [...uploadedFiles, ...incoming];
    if (combined.length > 3) {
      setFileError("Maximum 3 files allowed.");
      return false;
    }
    for (const f of incoming) {
      if (!ACCEPTED_MIME_TYPES.includes(f.type)) {
        setFileError(`"${f.name}" is not an accepted file type.`);
        return false;
      }
      if (f.size > 10 * 1024 * 1024) {
        setFileError(`"${f.name}" exceeds the 10MB limit.`);
        return false;
      }
    }
    onFilesChange(combined);
    return true;
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
    onUrlsChange((prev) => [...prev, trimmed]);
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
          handleFiles(Array.from(e.dataTransfer.files));
        }}
      >
        <div
          onClick={() => fileInputRef.current?.click()}
          className={`flex flex-col items-center justify-center py-8 px-6 cursor-pointer transition-colors border-2 border-dashed ${
            dragOver ? "border-teal bg-teal/[0.04]" : "border-border-light bg-white"
          }`}
        >
          {/* Upload cloud icon */}
          <svg
            width="28" height="28" viewBox="0 0 24 24" fill="none"
            strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
            className={`mb-2 ${dragOver ? "stroke-teal" : "stroke-[#bbb]"}`}
          >
            <polyline points="16,16 12,12 8,16" />
            <line x1="12" y1="12" x2="12" y2="21" />
            <path d="M20.39,18.39A5,5,0,0,0,18,9h-1.26A8,8,0,1,0,3,16.3" />
          </svg>
          <p className="text-sm text-[#555]">
            Drag &amp; drop files here, or{" "}
            <span className="underline text-link-blue">browse</span>
          </p>
          <p className="text-xs text-[#bbb] mt-1.5">
            PDF, DOCX, XLSX, PPTX, PNG, JPG, CSV — max 10MB each — up to 3 files
          </p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg,.csv"
          className="hidden"
          onChange={(e) => {
            const ok = handleFiles(Array.from(e.target.files ?? []));
            if (!ok) e.target.value = "";
            else e.target.value = "";
          }}
        />
      </div>

      {/* File error */}
      {fileError && <p className="text-xs text-[#e53e3e] mb-2">{fileError}</p>}

      {/* File chips */}
      {uploadedFiles.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {uploadedFiles.map((f, i) => (
            <div key={i} className="flex items-center gap-2 px-3 py-1.5 text-xs bg-grey-bg text-navy">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M13,2H6A2,2,0,0,0,4,4V20a2,2,0,0,0,2,2H18a2,2,0,0,0,2-2V9Z" />
                <polyline points="13,2 13,9 20,9" />
              </svg>
              <span className="font-medium">{f.name}</span>
              <span className="text-[#aaa]">({(f.size / 1024).toFixed(0)} KB)</span>
              <button
                onClick={() => onFilesChange((prev) => prev.filter((_, j) => j !== i))}
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
                  onClick={() => onUrlsChange((prev) => prev.filter((_, j) => j !== i))}
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
