"use client";

import type { QueueDocument, QueueRow } from "../types/verification-queue.schema";
import { formatDateTime } from "@/lib/utils";
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
import { Eye, FileText } from "lucide-react";
import { VerificationStateBadge } from "./DocumentDetailsDialog";

// VerificationQueueTable.tsx — verification queue table family (4 columns):
// one row per submitted document (flattened across the employee's queue rows),
// wrapper/header per QA §1.1, loading skeletons, exact colSpan=4 on
// loading/empty rows, overflow-x-auto guard. Status is the document's own
// workflow state; the document cell previews and the row action opens document
// details.

interface VerificationQueueTableProps {
  rows: QueueRow[];
  isLoading: boolean;
  onPreview: (row: QueueRow, doc: QueueDocument) => void;
  onViewDetails: (row: QueueRow, doc: QueueDocument) => void;
}

export function VerificationQueueTable({
  rows,
  isLoading,
  onPreview,
  onViewDetails,
}: VerificationQueueTableProps) {
  const entries = rows.flatMap((row) =>
    row.documents.map((doc) => ({ row, doc }))
  );

  return (
    <div className="bg-card border border-border/50 rounded-2xl overflow-hidden shadow-sm">
      <ul className="divide-y divide-border xl:hidden">
        {isLoading ? (
          <li className="space-y-2 p-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </li>
        ) : entries.length === 0 ? (
          <li className="flex h-48 flex-col items-center justify-center gap-2 p-4 text-center">
            <p className="text-muted-foreground">
              {rows.length === 0
                ? "No documents awaiting verification."
                : "This hire has not uploaded any documents yet."}
            </p>
            {rows.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Submitted hire documents queue here for HR approval.
              </p>
            )}
          </li>
        ) : (
          entries.map(({ row, doc }) => (
            <li key={`${row.userId}-${doc.docKey}`} className="space-y-2 p-4">
              <div className="flex items-start justify-between gap-2">
                <button
                  type="button"
                  onClick={() => onPreview(row, doc)}
                  className="inline-flex min-w-0 items-center gap-1.5 text-left text-sm font-medium hover:underline"
                  title={doc.title}
                >
                  <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate">{doc.title}</span>
                </button>
                <VerificationStateBadge state={doc.state} />
              </div>
              <p
                className="text-xs text-muted-foreground"
                title={doc.uploadedAt ?? ""}
              >
                {doc.uploadedAt ? formatDateTime(new Date(doc.uploadedAt)) : "—"}
              </p>
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  className="min-h-9 w-full sm:w-auto"
                  onClick={() => onViewDetails(row, doc)}
                  aria-label="View document details"
                >
                  <Eye className="mr-1 h-4 w-4" />
                  View details
                </Button>
              </div>
            </li>
          ))
        )}
      </ul>

      <div className="hidden overflow-x-auto xl:block">
        <Table className="min-w-[720px]">
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead>Document</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Updated</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={4}>
                  <div className="space-y-2 py-4">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4}>
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
            ) : entries.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4}>
                  <div className="flex h-48 flex-col items-center justify-center gap-2 text-center">
                    <p className="text-muted-foreground">
                      This hire has not uploaded any documents yet.
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              entries.map(({ row, doc }) => (
                <TableRow key={`${row.userId}-${doc.docKey}`}>
                  <TableCell className="max-w-[320px]">
                    <button
                      type="button"
                      onClick={() => onPreview(row, doc)}
                      className="inline-flex items-center gap-1.5 text-sm font-medium hover:underline min-w-0 text-left"
                      title={doc.title}
                    >
                      <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span className="max-w-[260px] truncate">{doc.title}</span>
                    </button>
                  </TableCell>
                  <TableCell>
                    <VerificationStateBadge state={doc.state} />
                  </TableCell>
                  <TableCell
                    className="max-w-[200px] truncate text-sm text-muted-foreground"
                    title={doc.uploadedAt ?? ""}
                  >
                    {doc.uploadedAt ? formatDateTime(new Date(doc.uploadedAt)) : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onViewDetails(row, doc)}
                      aria-label="View document details"
                      title="View details"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
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
