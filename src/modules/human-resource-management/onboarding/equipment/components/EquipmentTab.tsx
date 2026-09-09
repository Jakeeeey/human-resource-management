"use client";

import { useEffect, useState } from "react";

import { useOnboardingProfileFetch } from "../../hub/providers/profileProvider";
import {
  EquipmentFetchProvider,
  useEquipmentFetch,
} from "../providers/equipmentProvider";
import type { EquipmentAckMethod } from "../types/equipment-issue.schema";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AlertCircle, PackageCheck, RefreshCw } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

// EquipmentTab.tsx — hub Equipment tab body (Todo 13). Per-hire issue log
// over the pdf §9 catalog (+ admin-config extras): HR issues per item,
// the hiree digital-acknowledges per item (HR override allowed, both
// logged). FULLY_EQUIPPED answers true only at full required ack.
//
// BOUNDARY: asset assignment lives in Master List → EmployeeAssetsTab and
// is NEVER written here — this log references handover, never assets.

const ACK_METHODS: EquipmentAckMethod[] = ["ink", "stamp", "typed"];

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

function EquipmentTabBody() {
  const { profiles } = useOnboardingProfileFetch();
  const {
    status,
    isLoading,
    isError,
    error,
    refetch,
    issueItem,
    acknowledgeItem,
  } = useEquipmentFetch();
  const [profileId, setProfileId] = useState<number | null>(null);
  const [ackMethod, setAckMethod] = useState<EquipmentAckMethod>("typed");
  const [acting, setActing] = useState<string | null>(null);

  useEffect(() => {
    if (profileId === null && profiles.length > 0) {
      setProfileId(profiles[0]?.id ?? null);
    }
  }, [profiles, profileId]);

  useEffect(() => {
    if (profileId !== null) void refetch(profileId);
  }, [profileId, refetch]);

  const selectedProfile = profiles.find((p) => p.id === profileId) ?? null;

  async function handleIssue(itemKey: string) {
    if (profileId === null) return;
    setActing(`issue:${itemKey}`);
    try {
      await issueItem({ profile_id: profileId, item_key: itemKey });
      toast.success("Item issued");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Issue failed");
    } finally {
      setActing(null);
    }
  }

  async function handleAcknowledge(itemKey: string) {
    if (profileId === null || !selectedProfile) return;
    setActing(`ack:${itemKey}`);
    try {
      await acknowledgeItem({
        profile_id: profileId,
        item_key: itemKey,
        signer: `hiree:${selectedProfile.employee_id}`,
        method: ackMethod,
      });
      toast.success("Acknowledgement recorded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Acknowledge failed");
    } finally {
      setActing(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground max-w-[520px] truncate">
          {status
            ? `${status.items.filter((i) => i.acked).length}/${status.items.length} items acknowledged`
            : "Pick a hire to open their issue log"}
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Select
            value={profileId === null ? "" : String(profileId)}
            onValueChange={(v) => setProfileId(Number(v))}
          >
            <SelectTrigger className="h-10 w-full sm:w-[260px]">
              <SelectValue placeholder="Select hire" />
            </SelectTrigger>
            <SelectContent className="max-h-60">
              {profiles.map((p) => (
                <SelectItem key={p.id} value={String(p.id)}>
                  #{p.employee_id} — {p.status}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={ackMethod}
            onValueChange={(v) => setAckMethod(v as EquipmentAckMethod)}
          >
            <SelectTrigger className="h-10 w-full sm:w-[140px]">
              <SelectValue placeholder="Ack method" />
            </SelectTrigger>
            <SelectContent className="max-h-60">
              {ACK_METHODS.map((m) => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            onClick={() => {
              if (profileId !== null) void refetch(profileId);
            }}
            disabled={isLoading || profileId === null}
            className="w-full sm:w-auto"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Retry
          </Button>
        </div>
      </div>

      {status?.fullyEquipped && (
        <Alert>
          <PackageCheck className="h-4 w-4" />
          <AlertTitle>FULLY_EQUIPPED</AlertTitle>
          <AlertDescription>
            Every required item is issued and acknowledged for this hire.
          </AlertDescription>
        </Alert>
      )}

      {isError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Could not load equipment log</AlertTitle>
          <AlertDescription>{error?.message ?? "Fetch failed"}</AlertDescription>
        </Alert>
      )}

      <Card className="shadow-none border-border overflow-hidden">
        <CardHeader>
          <CardTitle className="max-w-[300px] truncate" title="Issue log">
            Issue log
          </CardTitle>
          <CardDescription>
            Pdf §9 handover items per hire. Asset assignment stays in Master
            List — this log records handover + digital acknowledgement only.
          </CardDescription>
        </CardHeader>
        <CardContent>
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
                ) : !status || status.items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      {profileId === null
                        ? "Select a hire to open their issue log."
                        : "No catalog items."}
                    </TableCell>
                  </TableRow>
                ) : (
                  status.items.map((item) => {
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
                          title={item.issued ? `${item.issuedBy ?? "issuer"} · ${item.issuedAt ?? ""}` : ""}
                        >
                          {item.issued
                            ? `${item.issuedBy ?? "issuer"} · ${item.issuedAt ?? ""}`
                            : "—"}
                        </TableCell>
                        <TableCell
                          className="max-w-[220px] truncate text-sm text-muted-foreground"
                          title={item.acked ? `${item.ackedBy ?? "hiree"} · ${item.ackMethod ?? ""}` : ""}
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
                                item.issued ||
                                acting !== null ||
                                profileId === null
                              }
                              onClick={() => void handleIssue(item.key)}
                              className="w-full sm:w-auto min-h-[32px]"
                            >
                              {acting === `issue:${item.key}`
                                ? "Issuing…"
                                : "Issue"}
                            </Button>
                            <Button
                              size="sm"
                              disabled={
                                !item.issued ||
                                item.acked ||
                                acting !== null ||
                                profileId === null
                              }
                              onClick={() => void handleAcknowledge(item.key)}
                              className="w-full sm:w-auto min-h-[32px]"
                            >
                              {acting === `ack:${item.key}`
                                ? "Saving…"
                                : "Acknowledge"}
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
        </CardContent>
      </Card>
    </div>
  );
}

export function EquipmentTab() {
  return (
    <EquipmentFetchProvider>
      <EquipmentTabBody />
    </EquipmentFetchProvider>
  );
}
