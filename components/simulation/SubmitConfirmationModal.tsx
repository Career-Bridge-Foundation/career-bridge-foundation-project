"use client";

import { Dialog } from "@/components/ui";
import type { SubmitWarning } from "@/lib/simulation/submitWarnings";

interface SubmitConfirmationModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  warnings: SubmitWarning[];
  isSubmitting?: boolean;
}

export function SubmitConfirmationModal({
  open,
  onClose,
  onConfirm,
  warnings,
  isSubmitting = false,
}: SubmitConfirmationModalProps) {
  const issues = warnings.filter((w) => w.severity === "warning");
  const reminders = warnings.filter((w) => w.severity === "info");
  const hasIssues = issues.length > 0;

  return (
    <Dialog open={open} onClose={isSubmitting ? () => {} : onClose}>
      <div className="flex flex-col gap-5 -m-2">
        <div>
          <h2 className="text-lg font-semibold text-navy">Review before you submit</h2>
          <p className="text-sm text-[#555] mt-2 leading-relaxed">
            You won&apos;t be able to edit your responses after submission. Check the items
            below — especially file uploads and document links.
          </p>
        </div>

        {hasIssues && (
          <div
            className="rounded-md border px-4 py-3"
            style={{ borderColor: "#f5c6c6", backgroundColor: "#fff5f5" }}
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-[#c53030] mb-2">
              Please fix or confirm
            </p>
            <ul className="space-y-2 text-sm text-[#742a2a] leading-relaxed list-disc pl-4">
              {issues.map((w, i) => (
                <li key={`issue-${i}`}>
                  {w.taskLabel && (
                    <span className="font-medium">{w.taskLabel}: </span>
                  )}
                  {w.message}
                </li>
              ))}
            </ul>
          </div>
        )}

        {reminders.length > 0 && (
          <div
            className="rounded-md border px-4 py-3"
            style={{ borderColor: "#bee3f8", backgroundColor: "#ebf8ff" }}
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-[#2b6cb0] mb-2">
              Reminders
            </p>
            <ul className="space-y-2 text-sm text-[#2c5282] leading-relaxed list-disc pl-4">
              {reminders.map((w, i) => (
                <li key={`reminder-${i}`}>
                  {w.taskLabel && (
                    <span className="font-medium">{w.taskLabel}: </span>
                  )}
                  {w.message}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex flex-wrap gap-3 justify-end pt-1">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="text-sm font-medium px-5 py-2.5 border border-navy text-navy bg-white disabled:opacity-50"
          >
            Go back and review
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isSubmitting}
            className="text-sm font-semibold px-5 py-2.5 text-white bg-navy disabled:opacity-50"
          >
            {hasIssues ? "Submit anyway" : "Yes, submit"}
          </button>
        </div>
      </div>
    </Dialog>
  );
}
