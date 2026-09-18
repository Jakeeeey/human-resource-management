"use client";

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
import { PenLine } from "lucide-react";
import { cn } from "@/lib/utils";
import { isCompletionPending } from "../../signing/signingCopy";
import { paperworksBadge } from "./paperworksBadge";
import { signingDeskJobFields } from "./signingDeskFields";
import type { SigningQueueRow } from "./SigningDeskQueueCards";

// SigningDeskTable.tsx — the lg+ queue table for the signing desk. Below lg
// the stacked cards (SigningDeskQueueCards) carry the same rows so the
// primary action is never hidden behind horizontal scroll.

const THEAD = (
  <TableRow className="bg-muted/30">
    <TableHead>Applicant</TableHead>
    <TableHead>Department</TableHead>
    <TableHead>Position</TableHead>
    <TableHead>Paperworks</TableHead>
    <TableHead className="text-right">Action</TableHead>
  </TableRow>
);

interface SigningDeskTableProps {
  rows: SigningQueueRow[];
  isLoading: boolean;
  launchingId: number | null;
  emptyCopy?: string;
  onOpen: (row: SigningQueueRow) => void;
}

export function SigningDeskTable({
  rows,
  isLoading,
  launchingId,
  emptyCopy,
  onOpen,
}: SigningDeskTableProps) {
  return (
    <div className="hidden overflow-x-auto lg:block">
      <Table>
        <TableHeader>{THEAD}</TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={5}>
                <div className="space-y-2 py-4">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              </TableCell>
            </TableRow>
          ) : rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5}>
                <p className="py-6 text-center text-muted-foreground">
                  {emptyCopy ?? "No applicants have a signing set yet."}
                </p>
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => {
              const hirePending = isCompletionPending(
                row.envelope.status,
                row.applicant.status
              );
              const paperworkBadge = paperworksBadge(row.paperworks);
              const fields = signingDeskJobFields(
                row.applicant.position_applied_for,
                row.offer
              );
              return (
                <TableRow key={row.envelope.id}>
                  <TableCell
                    className="max-w-[220px] truncate font-medium"
                    title={
                      row.applicant.position_applied_for ??
                      `Applicant #${row.applicant.id}`
                    }
                  >
                    {row.applicant.full_name}
                  </TableCell>
                  <TableCell
                    className="max-w-[200px] truncate"
                    title={fields.department ?? "No department on record"}
                  >
                    {fields.department ?? "—"}
                  </TableCell>
                  <TableCell
                    className="max-w-[200px] truncate"
                    title={fields.position ?? "No position on record"}
                  >
                    {fields.position ?? "—"}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={paperworkBadge.variant}
                      className={cn(
                        "max-w-[160px] truncate",
                        paperworkBadge.className
                      )}
                      title={paperworkBadge.label}
                    >
                      {paperworkBadge.label}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={launchingId !== null}
                      onClick={() => onOpen(row)}
                      aria-label={`Open signing set for ${row.applicant.full_name}`}
                      title={
                        hirePending
                          ? "Review — completion needs attention"
                          : row.envelope.status === "complete"
                            ? "Review the completed signing set"
                            : "Open the signing set"
                      }
                    >
                      <PenLine className="mr-2 h-4 w-4" />
                      {launchingId === row.envelope.id
                        ? "Opening…"
                        : row.envelope.status === "complete"
                          ? "Review"
                          : "Open signing set"}
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}
