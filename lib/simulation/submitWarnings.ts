import type { Prompt, StepResponse } from "@/types";
import type { EvidenceFile } from "@/hooks/useSimulation";

export type SubmitWarningSeverity = "warning" | "info";

export interface SubmitWarning {
  severity: SubmitWarningSeverity;
  message: string;
  taskLabel?: string;
}

const IMAGE_EXT = new Set(["png", "jpg", "jpeg", "gif", "webp"]);
const DOCUMENT_EXT = new Set(["pdf", "doc", "docx"]);
const SPREADSHEET_EXT = new Set(["csv", "xls", "xlsx"]);
const PRESENTATION_EXT = new Set(["ppt", "pptx"]);

const EVIDENCE_OK_EXT = new Set(["pdf", "png", "jpg", "jpeg", "gif", "webp", "csv"]);

function ext(name: string): string {
  const parts = name.toLowerCase().split(".");
  return parts.length > 1 ? (parts.pop() ?? "") : "";
}

function countWords(text: string): number {
  const t = text.trim();
  return t === "" ? 0 : t.split(/\s+/).length;
}

function fileCategory(name: string): "image" | "document" | "spreadsheet" | "presentation" | "other" {
  const e = ext(name);
  if (IMAGE_EXT.has(e)) return "image";
  if (DOCUMENT_EXT.has(e)) return "document";
  if (SPREADSHEET_EXT.has(e)) return "spreadsheet";
  if (PRESENTATION_EXT.has(e)) return "presentation";
  return "other";
}

function warn(
  severity: SubmitWarningSeverity,
  message: string,
  taskLabel?: string
): SubmitWarning {
  return { severity, message, taskLabel };
}

export function collectSubmitWarnings(
  prompts: Prompt[],
  responses: Record<number, StepResponse>,
  evidenceByTask: Record<number, { files: EvidenceFile[] }>
): SubmitWarning[] {
  const warnings: SubmitWarning[] = [];

  for (const prompt of prompts) {
    const idx = prompt.id - 1;
    const resp = responses[idx] ?? {};
    const label = `Task ${prompt.id}: ${prompt.title}`;

    if (prompt.type === "typed" || (prompt.type === "either" && (resp.mode ?? "typed") === "typed")) {
      const wc = countWords(resp.text ?? "");
      if (wc > 0 && wc < prompt.minWords) {
        warnings.push(
          warn(
            "warning",
            `Your written response is ${wc} words (minimum ${prompt.minWords}). Add more detail before submitting.`,
            label
          )
        );
      }
    }

    if (prompt.type === "either" && (resp.mode ?? "typed") === "upload") {
      if (!resp.file?.name) {
        warnings.push(
          warn(
            "warning",
            "You chose to upload a document but no file is attached. Upload your strategy as PDF or Word.",
            label
          )
        );
      } else {
        const cat = fileCategory(resp.file.name);
        if (cat === "image") {
          warnings.push(
            warn(
              "warning",
              `"${resp.file.name}" is an image. For this task, submit a PDF or Word document so evaluators can read your full strategy.`,
              label
            )
          );
        } else if (cat === "spreadsheet") {
          warnings.push(
            warn(
              "warning",
              `"${resp.file.name}" is a spreadsheet. If it contains your written strategy, a PDF or Word file is usually clearer for review.`,
              label
            )
          );
        } else if (cat === "presentation") {
          warnings.push(
            warn(
              "info",
              `"${resp.file.name}" is a presentation. Ensure all key points are readable without relying on speaker notes.`,
              label
            )
          );
        } else if (cat === "other") {
          warnings.push(
            warn(
              "warning",
              `"${resp.file.name}" may not be a supported document type. Use PDF, Word, images, spreadsheet, or CSV (max 10 MB).`,
              label
            )
          );
        }
      }
    }

    const evidence = evidenceByTask[prompt.id]?.files ?? [];
    for (const f of evidence) {
      const e = ext(f.name);
      if (!EVIDENCE_OK_EXT.has(e)) {
        warnings.push(
          warn(
            "warning",
            `Supporting evidence "${f.name}" on ${prompt.title} is not an accepted type. Use PDF, PNG, JPG, WEBP, GIF, or CSV.`,
            label
          )
        );
      } else if (fileCategory(f.name) === "image" && evidence.length === 1) {
        warnings.push(
          warn(
            "info",
            `Supporting evidence for ${prompt.title} is only an image. PDFs with research or analysis are easier for evaluators to review.`,
            label
          )
        );
      }
    }
  }

  const hasAnyEvidence = prompts.some((p) => (evidenceByTask[p.id]?.files.length ?? 0) > 0);
  if (!hasAnyEvidence) {
    warnings.push(
      warn(
        "info",
        "You have not attached supporting evidence on any task. Optional PDFs or CSVs (e.g. research notes) can strengthen your submission."
      )
    );
  }

  warnings.push(
    warn(
      "info",
      "Accepted submission files: PDF, Word, images, spreadsheets, and CSV (max 10 MB each). Supporting evidence: PDF, images, or CSV — up to 3 files per task."
    )
  );

  return warnings;
}
