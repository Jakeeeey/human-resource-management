"use client";

import { useEffect, useState } from "react";
import { OvertimeTable } from "./components/OvertimeTable";
import {
  fetchOvertimeRequests,
  approveOrRejectOvertimeRequest,
} from "./providers/fetchProvider";
import type { OvertimeRequestWithUser, ApprovalAction } from "./type";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function OvertimeRequestModule() {
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

  const handleRetry = async () => {
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
      <Card>
        <CardHeader>
          <CardTitle>Overtime Request Approval</CardTitle>
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
      <OvertimeTable
        data={requests}
        onApprove={handleApprove}
        onReject={handleReject}
        onRefresh={handleRetry}
        isLoading={isLoading}
      />
    </div>
  );
}
