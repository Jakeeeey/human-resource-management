"use client";

import { useEffect, useState, useMemo } from "react";
import { COETable } from "@/modules/human-resource-management/employee-admin/approval/coe-request/components/COETable";
import { COERequestFilters } from "@/modules/human-resource-management/employee-admin/approval/coe-request/components/COERequestFilters";
import {
  fetchCOERequests,
  approveOrRejectCOERequest,
} from "@/modules/human-resource-management/employee-admin/approval/coe-request/providers/fetchProvider";
import type { COERequestWithUser } from "@/modules/human-resource-management/employee-admin/approval/coe-request/type";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function COEApprovalContent() {
  const [requests, setRequests] = useState<COERequestWithUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  const [nameFilter, setNameFilter] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetchCOERequests();
      setRequests(response.data);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to load COE requests";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleApprove = async (coeId: number, remarks: string) => {
    try {
      await approveOrRejectCOERequest({
        coe_id: coeId,
        status: "APPROVED",
        remarks,
        approver_id: 0,
      });

      toast.success("COE request approved successfully");
      await loadData();
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to approve COE request";
      toast.error(errorMessage);
      throw err;
    }
  };

  const handleReject = async (coeId: number, remarks: string) => {
    try {
      await approveOrRejectCOERequest({
        coe_id: coeId,
        status: "REJECTED",
        remarks,
        approver_id: 0,
      });

      toast.success("COE request rejected successfully");
      await loadData();
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to reject COE request";
      toast.error(errorMessage);
      throw err;
    }
  };

  const handleRefresh = async () => {
    await loadData();
  };

  const resetFilters = () => {
    setSearchQuery("");
    setDateFrom(undefined);
    setDateTo(undefined);
    setNameFilter(null);
  };

  const employeeNames = useMemo(() => {
    const names = requests.map((req) => {
      return [req.user_fname, req.user_mname, req.user_lname]
        .filter(Boolean)
        .join(" ");
    });
    return Array.from(new Set(names)).sort();
  }, [requests]);

  const filteredRequests = useMemo(() => {
    let filtered = [...requests];

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((req) => {
        const fullName = [req.user_fname, req.user_mname, req.user_lname]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return (
          fullName.includes(query) ||
          req.purpose?.toLowerCase().includes(query)
        );
      });
    }

    if (dateFrom) {
      const fromDate = new Date(dateFrom);
      fromDate.setHours(0, 0, 0, 0);
      filtered = filtered.filter((req) => {
        const reqDate = new Date(req.request_date);
        return reqDate >= fromDate;
      });
    }

    if (dateTo) {
      const toDate = new Date(dateTo);
      toDate.setHours(23, 59, 59, 999);
      filtered = filtered.filter((req) => {
        const reqDate = new Date(req.request_date);
        return reqDate <= toDate;
      });
    }

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            COE Request
          </h1>
          <p className="text-muted-foreground">
            Review and process Certificate of Employment requests
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

      <Card>
        <CardContent className="pt-6">
          <COERequestFilters
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

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Showing <span className="font-semibold">{filteredRequests.length}</span>{" "}
          of <span className="font-semibold">{requests.length}</span> COE{" "}
          {requests.length === 1 ? "request" : "requests"}
        </p>
      </div>

      <COETable
        data={filteredRequests}
        onApprove={handleApprove}
        onReject={handleReject}
        onRefresh={handleRefresh}
        isLoading={isLoading}
      />
    </div>
  );
}
