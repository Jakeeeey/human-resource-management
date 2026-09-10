"use client";

import { useEffect, useState } from "react";

import { hireeSigner } from "../equipmentPredicate";
import {
  EquipmentFetchProvider,
  useEquipmentFetch,
} from "../providers/equipmentProvider";
import type { EquipmentAckMethod } from "../types/equipment-issue.schema";
import { EquipmentIssueTable } from "./EquipmentIssueTable";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { AlertCircle, PackageCheck, RefreshCw } from "lucide-react";
import { toast } from "sonner";

// EquipmentTab.tsx — workspace Equipment section. Per-EMPLOYEE issue log over
// the pdf §9 catalog (+ admin-config extras): HR issues per item, the employee
// acknowledges per item (HR override allowed, both logged). FULLY_EQUIPPED
// answers true only at full required ack. The employee is the canonical hire
// from the route (`user_id`), so there is no hire picker here.
//
// BOUNDARY: asset assignment lives in Master List → EmployeeAssetsTab and
// is NEVER written here — this log references handover, never assets.

const ACK_METHODS: EquipmentAckMethod[] = ["ink", "stamp", "typed"];

function EquipmentTabBody({ userId }: { userId: number }) {
  const {
    status,
    isLoading,
    isError,
    error,
    refetch,
    issueItem,
    acknowledgeItem,
  } = useEquipmentFetch();
  const [ackMethod, setAckMethod] = useState<EquipmentAckMethod>("typed");
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  useEffect(() => {
    void refetch(userId);
  }, [userId, refetch]);

  async function handleIssue(itemKey: string) {
    setPendingAction(`issue:${itemKey}`);
    try {
      await issueItem({ user_id: userId, item_key: itemKey });
      toast.success("Item issued");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Issue failed");
    } finally {
      setPendingAction(null);
    }
  }

  async function handleAcknowledge(itemKey: string) {
    setPendingAction(`ack:${itemKey}`);
    try {
      await acknowledgeItem({
        user_id: userId,
        item_key: itemKey,
        signer: hireeSigner(userId),
        method: ackMethod,
      });
      toast.success("Acknowledgement recorded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Acknowledge failed");
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground max-w-[520px] truncate">
          {status
            ? `${status.items.filter((i) => i.acked).length}/${status.items.length} items acknowledged`
            : `Equipment issue log for employee #${userId}`}
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
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
            onClick={() => void refetch(userId)}
            disabled={isLoading}
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
            Every required item is issued and acknowledged for this employee.
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
            Pdf §9 handover items per employee. Asset assignment stays in
            Master List — this log records handover + digital acknowledgement
            only.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EquipmentIssueTable
            items={status?.items ?? []}
            isLoading={isLoading}
            pendingAction={pendingAction}
            onIssue={(key) => void handleIssue(key)}
            onAcknowledge={(key) => void handleAcknowledge(key)}
          />
        </CardContent>
      </Card>
    </div>
  );
}

export function EquipmentTab({ userId }: { userId: number }) {
  return (
    <EquipmentFetchProvider>
      <EquipmentTabBody userId={userId} />
    </EquipmentFetchProvider>
  );
}
