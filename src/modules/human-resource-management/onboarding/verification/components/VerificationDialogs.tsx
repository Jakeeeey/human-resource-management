"use client";

import { useState } from "react";
import type {
  QueueDocument,
  QueueRow,
} from "../types/verification-queue.schema";
import { MAX_RETURN_REASON_LENGTH } from "../types/verification-queue.schema";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

// VerificationDialogs.tsx — return-with-reason dialog. Form state initializes
// from props on mount; callers remount via `key` per open/row so no
// set-state-in-effect is needed (ProfileDialog precedent). Footers stack on
// mobile (w-full sm:w-auto).

interface ReturnDialogProps {
  open: boolean;
  row: QueueRow | null;
  doc: QueueDocument | null;
  working: boolean;
  onClose: () => void;
  onSubmit: (row: QueueRow, doc: QueueDocument, reason: string) => void;
}

export function ReturnDialog({
  open,
  row,
  doc,
  working,
  onClose,
  onSubmit,
}: ReturnDialogProps) {
  const [reason, setReason] = useState("");
  const trimmed = reason.trim();
  const valid = trimmed.length > 0 && trimmed.length <= MAX_RETURN_REASON_LENGTH;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="w-[95vw] rounded-2xl sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="truncate" title="Return for resubmit">
            Return for resubmit
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <p className="text-sm text-muted-foreground">
            Returning marks this document returned for resubmit with the reason
            attached to the submission.
          </p>
          <div className="space-y-2">
            <Label htmlFor="onb-return-reason">Reason (required)</Label>
            <Textarea
              id="onb-return-reason"
              value={reason}
              disabled={working}
              onChange={(e) => setReason(e.target.value)}
              placeholder="What must the hiree fix before resubmitting?"
              maxLength={MAX_RETURN_REASON_LENGTH}
              rows={4}
            />
            <p className="text-xs text-muted-foreground text-right">
              {trimmed.length}/{MAX_RETURN_REASON_LENGTH}
            </p>
          </div>
        </div>
        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={working}
            className="w-full sm:w-auto"
          >
            Cancel
          </Button>
          <Button
            onClick={() => row && doc && valid && onSubmit(row, doc, trimmed)}
            disabled={!row || !doc || !valid || working}
            className="w-full sm:w-auto"
          >
            {working ? "Returning…" : "Return for resubmit"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

