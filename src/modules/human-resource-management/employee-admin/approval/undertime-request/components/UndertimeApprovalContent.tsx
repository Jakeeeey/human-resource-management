"use client";

import { useEffect, useState } from "react";
import { UndertimeTable } from "@/modules/human-resource-management/employee-admin/approval/undertime-request/components/UndertimeTable";
import {
  fetchUndertimeRequests,
  approveOrRejectUndertimeRequest,
} from "@/modules/human-resource-management/employee-admin/approval/undertime-request/providers/fetchProvider";
import type { UndertimeRequestWithUser } from "@/modules/human-resource-management/employee-admin/approval/undertime-request/type";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export default function UndertimeApprovalContent() {
  const [requests, setRequests] = useState<UndertimeRequestWithUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetchUndertimeRequests();
      setRequests(response.data);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to load undertime requests";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleApprove = async (undertimeId: number, remarks: string) => {
    try {
      await approveOrRejectUndertimeRequest({
        undertime_id: undertimeId,
        status: "approved",
        remarks,
        approver_id: 0, // Will be set by API from token
      });

      toast.success("Undertime request approved successfully");

      // Reload data
      await loadData();
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to approve undertime request";
      toast.error(errorMessage);
      throw err;
    }
  };

  const handleReject = async (undertimeId: number, remarks: string) => {
    try {
      await approveOrRejectUndertimeRequest({
        undertime_id: undertimeId,
        status: "rejected",
        remarks,
        approver_id: 0, // Will be set by API from token
      });

      toast.success("Undertime request rejected successfully");

      // Reload data
      await loadData();
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to reject undertime request";
      toast.error(errorMessage);
      throw err;
    }
  };

  const handleRefresh = async () => {
    console.log("Refresh button clicked - reloading data...");
    await loadData();
    console.log("Data reloaded successfully");
  };

  if (isLoading) {
    return (
      <div className="flex h-100 items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Undertime Request
          </h1>
          <p className="text-muted-foreground">
            View undertime requests for your department
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={isLoading}
          className="gap-2"
        >
          Refresh
        </Button>
      </div>

      <UndertimeTable
        data={requests}
        onApprove={handleApprove}
        onReject={handleReject}
        onRefresh={handleRefresh}
        isLoading={isLoading}
      />
    </div>
  );
}
