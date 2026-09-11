"use client";

import type { EquipmentItemStatus } from "../providers/equipmentProvider";
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

// EquipmentIssueTable.tsx — issue-log table for the hub equipment tab: one
// row per catalog item with issue/acknowledge actions. Presentation only —
// state and mutations stay in EquipmentTab / the provider. Below `xl` it
// renders stacked cards so the status + Actions columns stay visible at rest
// (S7#2); the min-w-[760px] table only renders once the content column can
// hold it (S7 NEW-1: ~344px at 768px, so `sm` was too early).

function statusBadge(item: {
  issued: boolean;
  acked: boolean;
}): { label: string; className: string } {
  if (item.acked)
    return {
      label: "Acknowledged",
      className:
        "border-green-500/20 text-green-600 bg-green-500/10 rounded-md px-2 py-0.5",
    };
  if (item.issued)
    return {
      label: "Issued",
      className:
        "border-yellow-500/20 text-yellow-600 bg-yellow-500/10 rounded-md px-2 py-0.5",
    };
  return {
    label: "Not issued",
    className:
      "border-border text-muted-foreground bg-muted/40 rounded-md px-2 py-0.5",
  };
}

interface EquipmentIssueTableProps {
  items: EquipmentItemStatus[];
  isLoading: boolean;
  pendingAction: string | null;
  onIssue: (itemKey: string) => void;
  onAcknowledge: (itemKey: string) => void;
}

function IssueActions({
  item,
  pendingAction,
  onIssue,
  onAcknowledge,
}: {
  item: EquipmentItemStatus;
  pendingAction: string | null;
  onIssue: (itemKey: string) => void;
  onAcknowledge: (itemKey: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
      <Button
        variant="outline"
        size="sm"
        disabled={item.issued || pendingAction !== null}
        onClick={() => onIssue(item.key)}
        className="w-full min-h-[32px] sm:w-auto"
      >
        {pendingAction === `issue:${item.key}` ? "Issuing…" : "Issue"}
      </Button>
      <Button
        size="sm"
        disabled={!item.issued || item.acked || pendingAction !== null}
        onClick={() => onAcknowledge(item.key)}
        className="w-full min-h-[32px] sm:w-auto"
      >
        {pendingAction === `ack:${item.key}` ? "Saving…" : "Acknowledge"}
      </Button>
    </div>
  );
}

export function EquipmentIssueTable({
  items,
  isLoading,
  pendingAction,
  onIssue,
  onAcknowledge,
}: EquipmentIssueTableProps) {
  if (isLoading) {
    return (
      <div className="space-y-2 py-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No catalog items.
      </p>
    );
  }

  return (
    <>
      {/* Below xl: stacked cards (S7#2, raised for S7 NEW-1). */}
      <ul className="divide-y divide-border xl:hidden">
        {items.map((item) => {
          const badge = statusBadge(item);
          return (
            <li key={item.key} className="space-y-2 py-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <span className="block truncate font-medium" title={item.label}>
                    {item.label}
                  </span>
                  {!item.required && (
                    <span className="text-xs text-muted-foreground">
                      optional
                    </span>
                  )}
                </div>
                <Badge variant="outline" className={badge.className}>
                  {badge.label}
                </Badge>
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  Issuer: <Badge variant="outline">{item.issuer}</Badge>
                </span>
                <span>
                  {item.issued
                    ? `Issued by ${item.issuedBy ?? "issuer"}`
                    : "Not issued"}
                </span>
                <span>
                  {item.acked
                    ? `Acknowledged by ${item.ackedBy ?? "hiree"} (${item.ackMethod ?? "—"})`
                    : "Not acknowledged"}
                </span>
              </div>
              <IssueActions
                item={item}
                pendingAction={pendingAction}
                onIssue={onIssue}
                onAcknowledge={onAcknowledge}
              />
            </li>
          );
        })}
      </ul>

      {/* xl+: the full six-column table. */}
      <div className="hidden overflow-x-auto xl:block">
        <Table className="min-w-[760px]">
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead>Issuer</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Issued</TableHead>
              <TableHead>Acknowledged</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => {
              const badge = statusBadge(item);
              return (
                <TableRow key={item.key}>
                  <TableCell className="font-medium">
                    <span
                      className="block max-w-[220px] truncate"
                      title={item.label}
                    >
                      {item.label}
                    </span>
                    {!item.required && (
                      <span className="text-xs text-muted-foreground">
                        optional
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{item.issuer}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={badge.className}>
                      {badge.label}
                    </Badge>
                  </TableCell>
                  <TableCell
                    className="max-w-[220px] truncate text-sm text-muted-foreground"
                    title={
                      item.issued
                        ? `${item.issuedBy ?? "issuer"} · ${item.issuedAt ?? ""}`
                        : ""
                    }
                  >
                    {item.issued
                      ? `${item.issuedBy ?? "issuer"} · ${item.issuedAt ?? ""}`
                      : "—"}
                  </TableCell>
                  <TableCell
                    className="max-w-[220px] truncate text-sm text-muted-foreground"
                    title={
                      item.acked
                        ? `${item.ackedBy ?? "hiree"} · ${item.ackMethod ?? ""}`
                        : ""
                    }
                  >
                    {item.acked
                      ? `${item.ackedBy ?? "hiree"} · ${item.ackMethod ?? ""}`
                      : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <IssueActions
                      item={item}
                      pendingAction={pendingAction}
                      onIssue={onIssue}
                      onAcknowledge={onAcknowledge}
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
