"use client";

import { useEffect, useState } from "react";
import { LeaveTable } from "./components/LeaveTable";
import {
  fetchLeaveRequests,
  approveOrRejectLeaveRequest,
} from "./providers/fetchProvider";
import type { LeaveRequestWithUser, ApprovalAction } from "./type";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function LeaveRequestModule() {
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

  const handleRetry = async () => {
    console.log("Refresh button clicked - reloading data...");
    await loadData();
    console.log("Data reloaded successfully");
  };

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Leave Request Approval</CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          <div className="mt-4">
            <Button onClick={handleRetry} variant="outline">
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
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
          onClick={handleRetry}
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
        onRefresh={handleRetry}
        isLoading={isLoading}
      />
    </div>
  );
}
