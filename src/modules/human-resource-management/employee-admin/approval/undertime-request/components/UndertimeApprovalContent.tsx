"use client";

import { useEffect, useState, useMemo } from "react";
import { UndertimeTable } from "@/modules/human-resource-management/employee-admin/approval/undertime-request/components/UndertimeTable";
import { UndertimeRequestFilters } from "@/modules/human-resource-management/employee-admin/approval/undertime-request/components/UndertimeRequestFilters";
import {
  fetchUndertimeRequests,
  approveOrRejectUndertimeRequest,
} from "@/modules/human-resource-management/employee-admin/approval/undertime-request/providers/fetchProvider";
import type { UndertimeRequestWithUser } from "@/modules/human-resource-management/employee-admin/approval/undertime-request/type";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function UndertimeApprovalContent() {
  const [requests, setRequests] = useState<UndertimeRequestWithUser[]>([]);
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
          req.reason?.toLowerCase().includes(query) ||
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

      {/* Filters Card */}
      <Card>
        <CardContent className="pt-6">
          <UndertimeRequestFilters
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
          of <span className="font-semibold">{requests.length}</span> undertime{" "}
          {requests.length === 1 ? "request" : "requests"}
        </p>
      </div>

      <UndertimeTable
        data={filteredRequests}
        onApprove={handleApprove}
        onReject={handleReject}
        onRefresh={handleRefresh}
        isLoading={isLoading}
      />
    </div>
  );
}
