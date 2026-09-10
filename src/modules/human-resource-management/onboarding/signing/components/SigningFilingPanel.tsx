"use client";

import { Badge } from "@/components/ui/badge";
import type { PaperworkItemStatus } from "../types/contracts";

// SigningFilingPanel.tsx — applicant-scoped filed-document summary (todo 13
// re-key). The signing aggregate is applicant-scoped: each `paperwork_item`
// carries its own `pdf_file` UUID once signed, so there is no per-envelope
// locked filing step. The panel lists every item's filed state; keys are
// `applicantId` / `item`.

export interface FiledDocumentSummary {
  id: number;
  templateTitle: string;
  status: PaperworkItemStatus;
  pdfFile: string | null;
}

interface SigningFilingPanelProps {
  applicantId: number;
  items: FiledDocumentSummary[];
}

export function SigningFilingPanel({
  applicantId,
  items,
}: SigningFilingPanelProps) {
  const filedCount = items.filter((item) => item.status === "signed").length;
  return (
    <section className="bg-card overflow-hidden rounded-2xl border border-border/50 shadow-sm">
      <div className="border-b border-border px-3 py-2 sm:px-4">
        <h2 className="truncate text-base font-semibold sm:text-lg" title="Filed documents">
          Filed documents
        </h2>
        <p className="truncate text-xs text-muted-foreground sm:text-sm">
          Applicant #{applicantId} — {filedCount}/{items.length} filed
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
                title={item.pdfFile ?? "Not filed yet"}
              >
                {item.pdfFile ?? "Not filed"}
              </span>
              <Badge variant={item.status === "signed" ? "default" : "outline"}>
                {item.status}
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
