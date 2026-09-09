"use client";

import { useState } from "react";
import type { QueueRow } from "../types/verification-queue.schema";
import { MAX_RETURN_REASON_LENGTH } from "../types/verification-queue.schema";
import { ACK_METHODS, buildDocRef } from "../types/acknowledgement-log.schema";
import type { AckMethod } from "../types/acknowledgement-log.schema";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

// VerificationDialogs.tsx — return-with-reason + record-acknowledgement
// dialogs. Form state initializes from props on mount; callers remount via
// `key` per open/row so no set-state-in-effect is needed (ProfileDialog
// precedent). Footers stack on mobile (w-full sm:w-auto).

interface ReturnDialogProps {
  open: boolean;
  row: QueueRow | null;
  working: boolean;
  onClose: () => void;
  onSubmit: (row: QueueRow, reason: string) => void;
}

export function ReturnDialog({ open, row, working, onClose, onSubmit }: ReturnDialogProps) {
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
            Employee #{row?.profile.employee_id} stays at DOCUMENTS_SUBMITTED
            with this reason attached; resubmit re-queues the row as pending.
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
            onClick={() => row && valid && onSubmit(row, trimmed)}
            disabled={!row || !valid || working}
            className="w-full sm:w-auto"
          >
            {working ? "Returning…" : "Return for resubmit"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface AckDialogProps {
  open: boolean;
  row: QueueRow | null;
  working: boolean;
  onClose: () => void;
  onSubmit: (row: QueueRow, signer: string, method: AckMethod) => void;
}

export function AckDialog({ open, row, working, onClose, onSubmit }: AckDialogProps) {
  const [signer, setSigner] = useState("");
  const [method, setMethod] = useState<AckMethod>("ink");
  const trimmed = signer.trim();
  const valid = trimmed.length > 0 && trimmed.length <= 120;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="w-[95vw] rounded-2xl sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="truncate" title="Record acknowledgement">
            Record acknowledgement
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <p className="text-sm text-muted-foreground">
            Writes one row to the audit-trail store — never the vault. Retrying
            the same signer never creates a second row (triple collapse).
          </p>
          <div className="space-y-2">
            <Label htmlFor="onb-ack-doc">Document ref</Label>
            <Input
              id="onb-ack-doc"
              disabled
              value={row ? buildDocRef(row.profile.id) : ""}
              className="bg-muted text-sm"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="onb-ack-signer">Signer</Label>
            <Input
              id="onb-ack-signer"
              value={signer}
              disabled={working}
              onChange={(e) => setSigner(e.target.value)}
              placeholder="Hiree name or employee id"
              maxLength={120}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="onb-ack-method">Method</Label>
            <div className="flex gap-2" role="radiogroup" aria-label="Acknowledgement method">
              {ACK_METHODS.map((m) => (
                <Button
                  key={m}
                  id={`onb-ack-method-${m}`}
                  type="button"
                  variant={method === m ? "default" : "outline"}
                  disabled={working}
                  onClick={() => setMethod(m)}
                  className="flex-1 capitalize"
                  aria-pressed={method === m}
                >
                  {m}
                </Button>
              ))}
            </div>
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
            onClick={() => row && valid && onSubmit(row, trimmed, method)}
            disabled={!row || !valid || working}
            className="w-full sm:w-auto"
          >
            {working ? "Recording…" : "Record acknowledgement"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
