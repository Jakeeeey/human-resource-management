"use client";

import { useEffect, useState } from "react";
import { LeaveTable } from "@/modules/human-resource-management/employee-admin/approval/leave-request/components/LeaveTable";
import {
  fetchLeaveRequests,
  approveOrRejectLeaveRequest,
} from "@/modules/human-resource-management/employee-admin/approval/leave-request/providers/fetchProvider";
import type { LeaveRequestWithUser } from "@/modules/human-resource-management/employee-admin/approval/leave-request/type";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export default function LeaveApprovalContent() {
  const [requests, setRequests] = useState<LeaveRequestWithUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetchLeaveRequests();
      setRequests(response.data);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to load leave requests";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleApprove = async (leaveId: number, remarks: string) => {
    try {
      await approveOrRejectLeaveRequest({
        leave_id: leaveId,
        status: "approved",
        remarks,
        approver_id: 0, // Will be set by API from token
      });

      toast.success("Leave request approved successfully");

      // Reload data
      await loadData();
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to approve leave request";
      toast.error(errorMessage);
      throw err;
    }
  };

  const handleReject = async (leaveId: number, remarks: string) => {
    try {
      await approveOrRejectLeaveRequest({
        leave_id: leaveId,
        status: "rejected",
        remarks,
        approver_id: 0, // Will be set by API from token
      });

      toast.success("Leave request rejected successfully");

      // Reload data
      await loadData();
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to reject leave request";
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
            Leave Request
          </h1>
          <p className="text-muted-foreground">
            View leave requests for your department
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

      <LeaveTable
        data={requests}
        onApprove={handleApprove}
        onReject={handleReject}
        onRefresh={handleRefresh}
        isLoading={isLoading}
      />
    </div>
  );
}
