"use client";

import { Badge } from "@/components/ui/badge";
import type { PaperworkItemStatus } from "../types/contracts";

// SigningFilingPanel.tsx — applicant-scoped signed-document summary (todo 13
// re-key). The signing aggregate is applicant-scoped: each `paperwork_item`
// carries its own `pdf_file` UUID once signed. Pre-hire the PDFs are STAGED
// only — the real employee_file_records filing happens post-hire — so the
// panel must never claim "filed". Once the applicant IS hired the filing has
// run, so the same panel flips to the filed state (S6#5).

export interface FiledDocumentSummary {
  id: number;
  templateTitle: string;
  status: PaperworkItemStatus;
  pdfFile: string | null;
}

interface SigningFilingPanelProps {
  applicantId: number;
  items: FiledDocumentSummary[];
  /** True once the hire is finalized and the staged PDFs have been filed. */
  filed?: boolean;
}

export function SigningFilingPanel({
  applicantId,
  items,
  filed = false,
}: SigningFilingPanelProps) {
  const signedCount = items.filter((item) => item.status === "signed").length;
  const title = filed
    ? "Signed documents (filed)"
    : "Signed documents (staged)";
  const subtitle = filed
    ? `Applicant #${applicantId} — ${signedCount}/${items.length} signed; filed to the employee record.`
    : `Applicant #${applicantId} — ${signedCount}/${items.length} signed; filed to the employee record after hire.`;
  return (
    <section className="bg-card overflow-hidden rounded-2xl border border-border/50 shadow-sm">
      <div className="border-b border-border px-3 py-2 sm:px-4">
        <h2 className="truncate text-base font-semibold sm:text-lg" title={title}>
          {title}
        </h2>
        <p className="truncate text-xs text-muted-foreground sm:text-sm">
          {subtitle}
        </p>
      </div>
      <ul className="divide-y divide-border">
        {items.map((item) => (
          <li
            key={item.id}
            className="flex items-center justify-between gap-3 px-3 py-2 sm:px-4"
          >
            <span className="min-w-0 truncate text-sm" title={item.templateTitle}>
              {item.templateTitle}
            </span>
            <span className="flex shrink-0 items-center gap-2">
              <span
                className="hidden max-w-[180px] truncate text-xs text-muted-foreground sm:inline"
                title={item.pdfFile ?? "Not signed yet"}
              >
                {item.pdfFile ?? "Not signed"}
              </span>
              <Badge
                variant={item.status === "signed" ? "default" : "outline"}
                title={
                  item.status === "signed"
                    ? filed
                      ? "Signed PDF filed to the employee record"
                      : "Signed PDF staged for filing after hire"
                    : "Awaiting signature"
                }
              >
                {item.status === "signed"
                  ? filed
                    ? "filed"
                    : "staged"
                  : item.status}
              </Badge>
            </span>
          </li>
        ))}
        {items.length === 0 && (
          <li className="px-3 py-6 text-center text-sm text-muted-foreground sm:px-4">
            No paperwork items in this signing set yet.
          </li>
        )}
      </ul>
    </section>
  );
}
