"use client";

import { useEffect, useState, useMemo } from "react";
import { OvertimeTable } from "./components/OvertimeTable";
import { OvertimeRequestFilters } from "./components/OvertimeRequestFilters";
import {
  fetchOvertimeRequests,
  approveOrRejectOvertimeRequest,
} from "./providers/fetchProvider";
import type { OvertimeRequestWithUser } from "./type";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function OvertimeRequestModule() {
  const [requests, setRequests] = useState<OvertimeRequestWithUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  const [nameFilter, setNameFilter] = useState<string | null>(null);

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

  // Filter reset function
  const resetFilters = () => {
    setSearchQuery("");
    setDateFrom(undefined);
    setDateTo(undefined);
    setNameFilter(null);
  };

  // Extract unique employee names for filter
  const employeeNames = useMemo(() => {
    const names = requests.map((req) => {
      return [req.user_fname, req.user_mname, req.user_lname]
        .filter(Boolean)
        .join(" ");
    });
    return Array.from(new Set(names)).sort();
  }, [requests]);

  // Apply filters to requests
  const filteredRequests = useMemo(() => {
    let filtered = [...requests];

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((req) => {
        const fullName = [req.user_fname, req.user_mname, req.user_lname]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return (
          fullName.includes(query) ||
          req.purpose?.toLowerCase().includes(query) ||
          req.remarks?.toLowerCase().includes(query)
        );
      });
    }

    // Date from filter
    if (dateFrom) {
      const fromDate = new Date(dateFrom);
      fromDate.setHours(0, 0, 0, 0);
      filtered = filtered.filter((req) => {
        const reqDate = new Date(req.filed_at);
        return reqDate >= fromDate;
      });
    }

    // Date to filter
    if (dateTo) {
      const toDate = new Date(dateTo);
      toDate.setHours(23, 59, 59, 999);
      filtered = filtered.filter((req) => {
        const reqDate = new Date(req.filed_at);
        return reqDate <= toDate;
      });
    }

    // Name filter
    if (nameFilter !== null) {
      filtered = filtered.filter((req) => {
        const fullName = [req.user_fname, req.user_mname, req.user_lname]
          .filter(Boolean)
          .join(" ");
        return fullName === nameFilter;
      });
    }

    return filtered;
  }, [requests, searchQuery, dateFrom, dateTo, nameFilter]);

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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Overtime Request
          </h1>
          <p className="text-muted-foreground">
            View overtime requests for your department
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

      {/* Filters Card */}
      <Card>
        <CardContent className="pt-6">
          <OvertimeRequestFilters
            searchQuery={searchQuery}
            dateFrom={dateFrom}
            dateTo={dateTo}
            nameFilter={nameFilter}
            employeeNames={employeeNames}
            onSearchChange={setSearchQuery}
            onDateFromChange={setDateFrom}
            onDateToChange={setDateTo}
            onNameFilterChange={setNameFilter}
            onResetFilters={resetFilters}
          />
        </CardContent>
      </Card>

      {/* Results Summary */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Showing <span className="font-semibold">{filteredRequests.length}</span>{" "}
          of <span className="font-semibold">{requests.length}</span> overtime{" "}
          {requests.length === 1 ? "request" : "requests"}
        </p>
      </div>

      <OvertimeTable
        data={filteredRequests}
        onApprove={handleApprove}
        onReject={handleReject}
        onRefresh={handleRetry}
        isLoading={isLoading}
      />
    </div>
  );
}
