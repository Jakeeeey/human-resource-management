"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { phaseLabel } from "../rosterData";
import { HireRosterDetail } from "./HireRosterDetail";
import type { HireRosterRow } from "../types/hire-roster.schema";

// HireRosterDialog.tsx — below-lg fallback for the master-detail roster
// (todo 27): the same detail content the lg+ pane shows, in the standard
// dialog shell, so small viewports keep full hire detail after a row tap.

/**
 * @param row - The tapped row, or null when the dialog is closed.
 * @param workspaceHref - Passed through to the detail pane's workspace link.
 * @param onClose - Clears the dialog row.
 */
export function HireRosterDialog({
  row,
  workspaceHref,
  onClose,
}: {
  row: HireRosterRow | null;
  workspaceHref?: string;
  onClose: () => void;
}) {
  const open = row !== null;
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent className="flex h-[85vh] w-[95vw] flex-col overflow-hidden rounded-2xl p-0 sm:max-w-[640px]">
        <DialogHeader className="shrink-0 border-b px-6 py-4">
          <DialogTitle className="truncate">
            {row ? row.name : "Hire detail"}
          </DialogTitle>
          <DialogDescription className="truncate">
            {row
              ? `Employee #${row.userId} · ${phaseLabel(row.phase)}`
              : "Employee onboarding detail"}
          </DialogDescription>
        </DialogHeader>
        <div className="flex min-h-0 flex-1 flex-col px-6 py-4">
          {row ? (
            <HireRosterDetail row={row} workspaceHref={workspaceHref} />
          ) : null}
        </div>
        <DialogFooter className="shrink-0 border-t bg-muted/20 px-6 py-4">
          <Button variant="outline" className="w-full sm:w-auto" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
