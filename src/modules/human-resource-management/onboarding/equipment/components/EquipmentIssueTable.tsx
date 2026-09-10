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
// state and mutations stay in EquipmentTab / the provider.

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

export function EquipmentIssueTable({
  items,
  isLoading,
  pendingAction,
  onIssue,
  onAcknowledge,
}: EquipmentIssueTableProps) {
  return (
    <div className="overflow-x-auto">
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
          ) : items.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center py-8">
                No catalog items.
              </TableCell>
            </TableRow>
          ) : (
            items.map((item) => {
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
                    <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={
                          item.issued || pendingAction !== null
                        }
                        onClick={() => onIssue(item.key)}
                        className="w-full sm:w-auto min-h-[32px]"
                      >
                        {pendingAction === `issue:${item.key}` ? "Issuing…" : "Issue"}
                      </Button>
                      <Button
                        size="sm"
                        disabled={
                          !item.issued || item.acked || pendingAction !== null
                        }
                        onClick={() => onAcknowledge(item.key)}
                        className="w-full sm:w-auto min-h-[32px]"
                      >
                        {pendingAction === `ack:${item.key}` ? "Saving…" : "Acknowledge"}
                      </Button>
                    </div>
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
