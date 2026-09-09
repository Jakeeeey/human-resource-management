"use client";

import { useVerificationQueue } from "../hooks/useVerificationQueue";
import { VerificationQueueTable } from "./VerificationQueueTable";
import { AckDialog, ReturnDialog } from "./VerificationDialogs";
import { AcknowledgementTrailDialog } from "./AcknowledgementTrailDialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCw } from "lucide-react";

// VerificationTab.tsx — hub Verification tab body (Todo 10): pending →
// approved | returned-for-resubmit queue with acknowledgement trail. Toolbar
// (counts + refresh with error-retry), queue table, return/ack dialogs, trail
// dialog. HR-only; the hiree portal is Todo 9 and lives elsewhere.

function dialogKey(dialog: { kind: string; row?: { profile: { id: number } } }): string {
  return dialog.kind === "none"
    ? "none"
    : `${dialog.kind}-${dialog.row?.profile.id ?? 0}`;
}

export function VerificationTab() {
  const {
    rows,
    counts,
    isLoading,
    isError,
    error,
    refetch,
    dialog,
    working,
    openReturn,
    openAck,
    openTrail,
    closeDialog,
    closeTrail,
    approve,
    submitReturn,
    resubmit,
    submitAck,
    trail,
    retryTrail,
  } = useVerificationQueue();

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          {counts.pending} pending · {counts.returned} returned ·{" "}
          {counts.approved} approved
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            variant="outline"
            onClick={() => void refetch()}
            disabled={isLoading}
            className="w-full sm:w-auto"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

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
        working={working}
        onApprove={(r) => void approve(r)}
        onReturn={openReturn}
        onResubmit={(r) => void resubmit(r)}
        onRecordAck={openAck}
        onTrail={openTrail}
      />

      <ReturnDialog
        key={dialogKey(dialog)}
        open={dialog.kind === "return"}
        row={dialog.kind === "return" ? dialog.row : null}
        working={working}
        onClose={closeDialog}
        onSubmit={(r, reason) => void submitReturn(r, reason)}
      />

      <AckDialog
        key={dialogKey(dialog)}
        open={dialog.kind === "ack"}
        row={dialog.kind === "ack" ? dialog.row : null}
        working={working}
        onClose={closeDialog}
        onSubmit={(r, signer, method) => void submitAck(r, signer, method)}
      />

      <AcknowledgementTrailDialog
        open={dialog.kind === "trail"}
        row={dialog.kind === "trail" ? dialog.row : null}
        docRef={trail.docRef}
        logs={trail.logs}
        isLoading={trail.isLoading}
        isError={trail.isError}
        errorMessage={trail.error?.message ?? null}
        onRetry={() => void retryTrail()}
        onClose={closeTrail}
      />
    </div>
  );
}
