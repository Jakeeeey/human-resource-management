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
import { isCompletionPending } from "../../signing/signingCopy";
import type { SigningQueueRow } from "./SigningDeskQueueCards";

// SigningDeskTable.tsx — the lg+ queue table for the signing desk. Below lg
// the stacked cards (SigningDeskQueueCards) carry the same rows so the
// primary action is never hidden behind horizontal scroll.

const THEAD = (
  <TableRow className="bg-muted/30">
    <TableHead>Applicant</TableHead>
    <TableHead>Applicant status</TableHead>
    <TableHead>Offer</TableHead>
    <TableHead>Paperworks</TableHead>
    <TableHead>Envelope</TableHead>
    <TableHead className="text-right">Action</TableHead>
  </TableRow>
);

interface SigningDeskTableProps {
  rows: SigningQueueRow[];
  isLoading: boolean;
  launchingId: number | null;
  onOpen: (row: SigningQueueRow) => void;
}

export function SigningDeskTable({
  rows,
  isLoading,
  launchingId,
  onOpen,
}: SigningDeskTableProps) {
  return (
    <div className="hidden overflow-x-auto lg:block">
      <Table>
        <TableHeader>{THEAD}</TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={6}>
                <div className="space-y-2 py-4">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              </TableCell>
            </TableRow>
          ) : rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6}>
                <p className="py-6 text-center text-muted-foreground">
                  No applicants have a signing set yet.
                </p>
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => {
              const hirePending = isCompletionPending(
                row.envelope.status,
                row.applicant.status
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
                  <TableCell>
                    <Badge
                      variant="outline"
                      className="max-w-[180px] truncate"
                      title={row.applicant.status ?? "unknown"}
                    >
                      {row.applicant.status ?? "—"}
                    </Badge>
                  </TableCell>
                  <TableCell
                    className="max-w-[160px] truncate"
                    title={row.offer ? row.offer.status : "No offer"}
                  >
                    {row.offer ? row.offer.status : "—"}
                  </TableCell>
                  <TableCell
                    className="max-w-[200px] truncate"
                    title={
                      row.paperworks
                        ? `${row.paperworks.status} (${row.paperworks.signed_count}/${row.paperworks.required_count})`
                        : "No paperworks"
                    }
                  >
                    {row.paperworks
                      ? `${row.paperworks.status} (${row.paperworks.signed_count}/${row.paperworks.required_count})`
                      : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        hirePending
                          ? "outline"
                          : row.envelope.status === "complete"
                            ? "default"
                            : "secondary"
                      }
                      className={
                        hirePending
                          ? "max-w-[180px] truncate border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                          : "max-w-[140px] truncate"
                      }
                      title={
                        hirePending
                          ? "Signing complete — the employee record has not been created yet"
                          : row.envelope.status
                      }
                    >
                      {hirePending
                        ? "complete — hire pending"
                        : row.envelope.status}
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
