"use client";

import React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import type { LeaveRequestWithDetails, PaginationState } from "../type";

// ============================================================================
// PROPS
// ============================================================================

interface LeaveReportTableProps {
  data: LeaveRequestWithDetails[];
  isLoading: boolean;
  pagination: PaginationState;
  onPageChange: (page: number) => void;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getStatusBadge(status: string) {
  const statusMap: Record<
    string,
    { variant: "default" | "destructive" | "outline" | "secondary"; label: string }
  > = {
    pending: { variant: "outline", label: "Pending" },
    approved: { variant: "default", label: "Approved" },
    rejected: { variant: "destructive", label: "Rejected" },
    cancelled: { variant: "secondary", label: "Cancelled" },
  };

  const config = statusMap[status] || { variant: "outline", label: status };

  return <Badge variant={config.variant}>{config.label}</Badge>;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function LeaveReportTable({
  data,
  isLoading,
  pagination,
  onPageChange,
}: LeaveReportTableProps) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-lg border border-dashed">
        <div className="text-center">
          <p className="text-lg font-semibold text-muted-foreground">
            No leave requests found
          </p>
          <p className="text-sm text-muted-foreground">
            Try adjusting your filters or search query
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Request Date</TableHead>
              <TableHead>From</TableHead>
              <TableHead>To</TableHead>
              <TableHead>Days</TableHead>
              <TableHead>Purpose</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Remarks</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((request) => (
              <TableRow key={request.leave_id}>
                {/* Name */}
                <TableCell className="font-medium">
                  {request.employee_name}
                </TableCell>

                {/* Request Date */}
                <TableCell>
                  {request.filed_at
                    ? format(new Date(request.filed_at), "MMM dd, yyyy")
                    : "N/A"}
                </TableCell>

                {/* From */}
                <TableCell>
                  {request.leave_start
                    ? format(new Date(request.leave_start), "MMM dd, yyyy")
                    : "N/A"}
                </TableCell>

                {/* To */}
                <TableCell>
                  {request.leave_end
                    ? format(new Date(request.leave_end), "MMM dd, yyyy")
                    : "N/A"}
                </TableCell>

                {/* Days */}
                <TableCell>{request.total_days || "0"}</TableCell>

                {/* Purpose */}
                <TableCell className="max-w-xs truncate">
                  {request.reason || "N/A"}
                </TableCell>

                {/* Type */}
                <TableCell className="capitalize">
                  {request.leave_type || "N/A"}
                </TableCell>

                {/* Status */}
                <TableCell>{getStatusBadge(request.status)}</TableCell>

                {/* Remarks */}
                <TableCell className="max-w-xs">
                  {request.remarks ? (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="truncate block cursor-help">
                            {request.remarks}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-md">
                          <p>{request.remarks}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  ) : (
                    "—"
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination Controls */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          0 of {pagination.totalItems} row(s) selected.
        </p>
        {pagination.totalPages > 1 && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (pagination.currentPage > 1) {
                  onPageChange(pagination.currentPage - 1);
                }
              }}
              disabled={pagination.currentPage === 1}
              className="px-3 py-2 text-sm border rounded hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <button
              onClick={() => {
                if (pagination.currentPage < pagination.totalPages) {
                  onPageChange(pagination.currentPage + 1);
                }
              }}
              disabled={pagination.currentPage === pagination.totalPages}
              className="px-3 py-2 text-sm border rounded hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
