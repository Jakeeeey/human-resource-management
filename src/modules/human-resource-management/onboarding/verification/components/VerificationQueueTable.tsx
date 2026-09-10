"use client";

import type { QueueRow } from "../types/verification-queue.schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  CheckCircle2,
  History,
  PenLine,
  RotateCcw,
  ScrollText,
  Undo2,
} from "lucide-react";

// VerificationQueueTable.tsx — verification queue table family (6 columns):
// wrapper/header per QA §1.1, every text column capped + truncated with title,
// loading skeletons, exact colSpan=6 on loading/empty rows, overflow-x-auto
// guard. Per-row ack status (count + last-ack) is the per-recipient status
// port; actions gate on queue state (approve/return on pending, resubmit on
// returned, trail + record-ack everywhere).

interface VerificationQueueTableProps {
  rows: QueueRow[];
  isLoading: boolean;
  working: boolean;
  onApprove: (row: QueueRow) => void;
  onReturn: (row: QueueRow) => void;
  onResubmit: (row: QueueRow) => void;
  onRecordAck: (row: QueueRow) => void;
  onTrail: (row: QueueRow) => void;
}

function stateBadge(state: QueueRow["queueState"]) {
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
  return (
    <Badge variant="outline" className="max-w-[160px] truncate" title="pending">
      Pending
    </Badge>
  );
}

export function VerificationQueueTable({
  rows,
  isLoading,
  working,
  onApprove,
  onReturn,
  onResubmit,
  onRecordAck,
  onTrail,
}: VerificationQueueTableProps) {
  return (
    <div className="bg-card border border-border/50 rounded-2xl overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead>Employee</TableHead>
              <TableHead>Queue</TableHead>
              <TableHead>Return reason</TableHead>
              <TableHead>Ack trail</TableHead>
              <TableHead>Updated</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6}>
                  <div className="space-y-2 py-4">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6}>
                  <div className="flex h-48 flex-col items-center justify-center gap-2 text-center">
                    <p className="text-muted-foreground">
                      No documents awaiting verification.
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Submitted hire documents queue here for HR approval.
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.userId}>
                  <TableCell
                    className="max-w-[140px] truncate font-medium"
                    title={String(row.userId)}
                  >
                    #{row.userId}
                  </TableCell>
                  <TableCell>{stateBadge(row.queueState)}</TableCell>
                  <TableCell
                    className="max-w-[220px] truncate text-sm text-muted-foreground"
                    title={row.returnReason ?? ""}
                  >
                    {row.returnReason ?? "—"}
                  </TableCell>
                  <TableCell>
                    {row.ackCount > 0 ? (
                      <span
                        className="inline-flex items-center gap-1 text-sm text-emerald-600"
                        title={row.lastAcknowledgedAt ?? ""}
                      >
                        <CheckCircle2 className="h-4 w-4 shrink-0" />
                        <span className="max-w-[140px] truncate">
                          {row.ackCount} ack{row.ackCount === 1 ? "" : "s"}
                        </span>
                      </span>
                    ) : (
                      <span className="text-sm text-muted-foreground">
                        Not acked
                      </span>
                    )}
                  </TableCell>
                  <TableCell
                    className="max-w-[180px] truncate"
                    title={row.updatedAt ?? ""}
                  >
                    {row.updatedAt ?? "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {row.queueState === "pending" && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={working}
                            onClick={() => onApprove(row)}
                            aria-label={`Approve documents for employee ${row.userId}`}
                            title="Approve"
                          >
                            <CheckCircle2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={working}
                            onClick={() => onReturn(row)}
                            aria-label={`Return documents for employee ${row.userId} for resubmit`}
                            title="Return for resubmit"
                          >
                            <Undo2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                      {row.queueState === "returned" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={working}
                          onClick={() => onResubmit(row)}
                          aria-label={`Resubmit documents for employee ${row.userId}`}
                          title="Resubmit"
                        >
                          <RotateCcw className="h-4 w-4" />
                        </Button>
                      )}
                      {row.queueState === "approved" && (
                        <span
                          className="inline-flex items-center gap-1 px-2 text-xs text-muted-foreground"
                          title="Approved — read-only history"
                        >
                          <History className="h-4 w-4 shrink-0" />
                        </span>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={working}
                        onClick={() => onRecordAck(row)}
                        aria-label={`Record acknowledgement for employee ${row.userId}`}
                        title="Record acknowledgement"
                      >
                        <PenLine className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onTrail(row)}
                        aria-label={`View acknowledgement trail for employee ${row.userId}`}
                        title="Acknowledgement trail"
                      >
                        <ScrollText className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
