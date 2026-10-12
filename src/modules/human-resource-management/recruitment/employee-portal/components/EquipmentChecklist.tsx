"use client";

import { AlertCircle, PackageCheck } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { formatDateTime } from "@/lib/utils";

import type { PortalEquipmentItem } from "../types/portal-equipment.schema";

// EquipmentChecklist.tsx — post-hire portal tab: HR-issued handover items the
// hiree acknowledges. Issued/Acknowledged show the TZ-safe human-readable date
// and time only (parsed from the PH wall-time components, never passed to
// `new Date(string)`); the signer is never displayed. Presentation only — the
// ack intent travels through the portal fetch provider, which resolves
// identity server-side.

interface EquipmentChecklistProps {
  items: PortalEquipmentItem[];
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  acknowledgingKey: string | null;
  onAcknowledge: (itemKey: string) => void;
}

function formatWallDateTime(value: string | null): string {
  if (!value) return "—";
  const match = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/.exec(
    value
  );
  if (!match) return "—";
  const date = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    Number(match[4]),
    Number(match[5]),
    Number(match[6] ?? 0)
  );
  if (Number.isNaN(date.getTime())) return "—";
  return formatDateTime(date);
}

function issuerLabel(issuer: string): string {
  if (!issuer) return "—";
  const role = issuer.toLowerCase();
  return role === "it" ? "IT" : role.charAt(0).toUpperCase() + role.slice(1);
}

export function EquipmentChecklist({
  items,
  isLoading,
  isError,
  error,
  acknowledgingKey,
  onAcknowledge,
}: EquipmentChecklistProps) {
  const issued = items.filter((item) => item.issued);
  const ackedCount = issued.filter((item) => item.acked).length;

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-primary/10 rounded-xl shrink-0">
          <PackageCheck className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0">
          <h2 className="text-xl sm:text-2xl font-bold truncate">Equipment</h2>
          <p className="text-sm text-muted-foreground">
            {issued.length > 0
              ? `${ackedCount}/${issued.length} issued items acknowledged`
              : "Equipment handed over to you by HR."}
          </p>
        </div>
      </div>

      {isError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Could not load your equipment</AlertTitle>
          <AlertDescription>{error?.message ?? "Fetch failed"}</AlertDescription>
        </Alert>
      )}

      <div className="bg-card border border-border/50 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead>Item</TableHead>
                <TableHead>Issuer</TableHead>
                <TableHead>Issued</TableHead>
                <TableHead>Acknowledged</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5}>
                    <div className="space-y-2 py-4">
                      <Skeleton className="h-10 w-full" />
                      <Skeleton className="h-10 w-full" />
                      <Skeleton className="h-10 w-full" />
                    </div>
                  </TableCell>
                </TableRow>
              ) : issued.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5}>
                    <div className="flex h-48 flex-col items-center justify-center gap-2 text-center">
                      <p className="text-muted-foreground">
                        No equipment issued yet.
                      </p>
                      <p className="text-sm text-muted-foreground">
                        HR records each handover item here.
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                issued.map((item) => (
                  <TableRow key={item.key}>
                    <TableCell
                      className="max-w-[320px] truncate font-medium"
                      title={item.label}
                    >
                      {item.label}
                      {!item.required && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          optional
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{issuerLabel(item.issuer)}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatWallDateTime(item.issuedAt)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {item.acked
                        ? formatWallDateTime(item.ackedAt)
                        : "Not acknowledged"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        disabled={item.acked || acknowledgingKey !== null}
                        onClick={() => onAcknowledge(item.key)}
                        className="w-full min-h-[32px] sm:w-auto"
                      >
                        {acknowledgingKey === item.key
                          ? "Saving…"
                          : item.acked
                            ? "Acknowledged"
                            : "Acknowledge"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </section>
  );
}
