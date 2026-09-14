"use client";

import type { QueueDocument, QueueRow } from "../types/verification-queue.schema";
import type { DocumentVerificationState } from "../types/document-verification.schema";
import { formatDateTime } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CheckCircle2, Download, FileText, Undo2 } from "lucide-react";

export function VerificationStateBadge({
  state,
}: {
  state: QueueRow["queueState"] | DocumentVerificationState;
}) {
  if (state === "approved") {
    return (
      <Badge
        variant="outline"
        className="max-w-[160px] truncate border-emerald-300 text-emerald-700"
        title="approved"
      >
        Approved
      </Badge>
    );
  }
  if (state === "returned") {
    return (
      <Badge
        variant="outline"
        className="max-w-[160px] truncate border-amber-300 text-amber-700"
        title="returned-for-resubmit"
      >
        Returned
      </Badge>
    );
  }
  if (state === "resubmitted") {
    return (
      <Badge
        variant="outline"
        className="max-w-[160px] truncate border-sky-300 text-sky-700"
        title="resubmitted"
      >
        Resubmitted
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="max-w-[160px] truncate" title="pending">
      Pending
    </Badge>
  );
}

interface DocumentDetailsDialogProps {
  open: boolean;
  row: QueueRow | null;
  doc: QueueDocument | null;
  working: boolean;
  onPreview: (row: QueueRow, doc: QueueDocument) => void;
  onApprove: (row: QueueRow, doc: QueueDocument) => void;
  onReturn: (row: QueueRow, doc: QueueDocument) => void;
  onClose: () => void;
}

export function DocumentDetailsDialog({
  open,
  row,
  doc,
  working,
  onPreview,
  onApprove,
  onReturn,
  onClose,
}: DocumentDetailsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="w-[95vw] rounded-2xl sm:max-w-[500px] max-h-[90vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-0 shrink-0">
          <DialogTitle className="truncate" title="Document details">
            Document details
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3 min-h-0">
          {row && doc ? (
            <>
              <div className="flex items-center gap-2 rounded-lg border px-3 py-2 min-w-0">
                <button
                  type="button"
                  onClick={() => onPreview(row, doc)}
                  className="flex items-center gap-2 min-w-0 flex-1 text-left"
                  title={doc.title}
                >
                  <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="text-sm font-bold truncate min-w-0 flex-1 hover:underline">
                    {doc.title}
                  </span>
                </button>
                <a
                  href={`/api/hrm/employee-admin/employee-master-list/assets/${doc.fileId}?filename=${encodeURIComponent(doc.title)}`}
                  download
                  className="shrink-0 rounded-md p-1 hover:bg-muted"
                  title="Download document"
                  aria-label="Download document"
                >
                  <Download className="h-4 w-4 shrink-0 text-muted-foreground" />
                </a>
              </div>

              <div className="grid grid-cols-2 gap-2 min-w-0">
                <div className="rounded-lg bg-muted/40 border px-3 py-2 min-w-0">
                  <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest leading-none">
                    State
                  </span>
                  <span className="mt-1.5 block">
                    <VerificationStateBadge state={doc.state} />
                  </span>
                </div>
                <div className="rounded-lg bg-muted/40 border px-3 py-2 min-w-0">
                  <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest leading-none">
                    Uploaded
                  </span>
                  <span
                    className="text-[11px] font-bold truncate mt-0.5 block"
                    title={doc.uploadedAt ?? ""}
                  >
                    {doc.uploadedAt ? formatDateTime(new Date(doc.uploadedAt)) : "—"}
                  </span>
                </div>
                <div className="rounded-lg bg-muted/40 border px-3 py-2 min-w-0">
                  <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest leading-none">
                    Submission updated
                  </span>
                  <span
                    className="text-[11px] font-bold truncate mt-0.5 block"
                    title={row.updatedAt ?? ""}
                  >
                    {row.updatedAt ? formatDateTime(new Date(row.updatedAt)) : "—"}
                  </span>
                </div>
              </div>

              <div className="rounded-lg bg-muted/40 border px-3 py-2 min-w-0">
                <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest leading-none">
                  Return reason
                </span>
                <p
                  className="text-xs text-muted-foreground mt-1 break-words"
                  title={doc.returnReason ?? ""}
                >
                  {doc.returnReason ?? "—"}
                </p>
              </div>
            </>
          ) : null}
        </div>

        <div className="px-6 py-3 border-t shrink-0 flex flex-wrap justify-end gap-2 bg-background">
          <Button
            variant="ghost"
            className="px-5 font-bold h-9 text-xs rounded-xl"
            onClick={onClose}
            disabled={working}
          >
            Close
          </Button>
          <Button
            variant="outline"
            className="h-9 text-xs font-bold rounded-xl gap-1.5"
            disabled={working || !row || !doc || doc.state === "approved"}
            onClick={() => row && doc && onReturn(row, doc)}
          >
            <Undo2 className="h-3.5 w-3.5" />
            Return for resubmit
          </Button>
          <Button
            className="h-9 text-xs font-bold rounded-xl gap-1.5"
            disabled={working || !row || !doc || doc.state === "approved"}
            onClick={() => row && doc && onApprove(row, doc)}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            Approve
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
