"use client";

import { useVerificationQueue } from "../hooks/useVerificationQueue";
import { VerificationQueueTable } from "./VerificationQueueTable";
import { ReturnDialog } from "./VerificationDialogs";
import { DocumentDetailsDialog } from "./DocumentDetailsDialog";
import { DocumentPreviewDialog } from "./DocumentPreviewDialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

// VerificationTab.tsx — hub Verification tab body (Todo 10): pending →
// approved | returned-for-resubmit queue. Document queue table, per-document
// return dialog, document preview + details dialogs. HR-only; the hiree portal
// is Todo 9 and lives elsewhere.

/**
 * @param userId - The canonical selected hire from the workspace route; the
 * surface renders ONLY this employee's documents verification state.
 */
export function VerificationTab({ userId }: { userId: number }) {
  const {
    rows,
    isLoading,
    isError,
    error,
    dialog,
    preview,
    working,
    openReturn,
    openPreview,
    openDetails,
    closeDialog,
    closeDetails,
    closePreview,
    approveDocument,
    returnDocument,
  } = useVerificationQueue(userId);

  return (
    <div className="space-y-4">
      {isError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Could not load verification queue</AlertTitle>
          <AlertDescription>
            {error?.message ?? "Fetch failed"}
          </AlertDescription>
        </Alert>
      )}

      <VerificationQueueTable
        rows={rows}
        isLoading={isLoading}
        onPreview={openPreview}
        onViewDetails={openDetails}
      />

      <ReturnDialog
        key={
          dialog.kind === "return"
            ? `return-${dialog.row.userId}-${dialog.doc.docKey}`
            : "return-closed"
        }
        open={dialog.kind === "return"}
        row={dialog.kind === "return" ? dialog.row : null}
        doc={dialog.kind === "return" ? dialog.doc : null}
        working={working}
        onClose={closeDialog}
        onSubmit={(r, d, reason) => void returnDocument(r, d, reason)}
      />

      <DocumentPreviewDialog
        key={
          preview
            ? `preview-${preview.row.userId}-${preview.doc.docKey}`
            : "preview-closed"
        }
        open={preview !== null}
        doc={preview?.doc ?? null}
        onClose={closePreview}
      />

      <DocumentDetailsDialog
        key={
          dialog.kind === "details"
            ? `details-${dialog.row.userId}-${dialog.doc.docKey}`
            : "details-closed"
        }
        open={dialog.kind === "details"}
        row={dialog.kind === "details" ? dialog.row : null}
        doc={dialog.kind === "details" ? dialog.doc : null}
        working={working}
        onPreview={openPreview}
        onApprove={(r, d) => void approveDocument(r, d)}
        onReturn={openReturn}
        onClose={closeDetails}
      />
    </div>
  );
}
