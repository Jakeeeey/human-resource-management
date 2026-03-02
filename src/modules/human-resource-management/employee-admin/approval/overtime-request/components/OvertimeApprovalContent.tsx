"use client";

import { useEffect, useState } from "react";
import { OvertimeTable } from "@/modules/human-resource-management/employee-admin/approval/overtime-request/components/OvertimeTable";
import {
  fetchOvertimeRequests,
  approveOrRejectOvertimeRequest,
} from "@/modules/human-resource-management/employee-admin/approval/overtime-request/providers/fetchProvider";
import type { OvertimeRequestWithUser } from "@/modules/human-resource-management/employee-admin/approval/overtime-request/type";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function OvertimeApprovalContent() {
  const [requests, setRequests] = useState<OvertimeRequestWithUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetchOvertimeRequests();
      setRequests(response.data);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to load overtime requests";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleApprove = async (overtimeId: number, remarks: string) => {
    try {
      await approveOrRejectOvertimeRequest({
        overtime_id: overtimeId,
        status: "approved",
        remarks,
        approver_id: 0, // Will be set by API from token
      });

      toast.success("Overtime request approved successfully");

      // Reload data
      await loadData();
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to approve overtime request";
      toast.error(errorMessage);
      throw err;
    }
  };

  const handleReject = async (overtimeId: number, remarks: string) => {
    try {
      await approveOrRejectOvertimeRequest({
        overtime_id: overtimeId,
        status: "rejected",
        remarks,
        approver_id: 0, // Will be set by API from token
      });

      toast.success("Overtime request rejected successfully");

      // Reload data
      await loadData();
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to reject overtime request";
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
    <OvertimeTable
      data={requests}
      onApprove={handleApprove}
      onReject={handleReject}
      onRefresh={handleRefresh}
      isLoading={isLoading}
    />
  );
}
