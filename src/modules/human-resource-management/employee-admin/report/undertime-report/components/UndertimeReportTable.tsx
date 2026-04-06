"use client";

import { useState } from "react";
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
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import type { UndertimeRequestWithDetails, PaginationState } from "../type";
import { ViewDetailsModal } from "./ViewDetailsModal";

// ============================================================================
// PROPS
// ============================================================================

interface UndertimeReportTableProps {
  data: UndertimeRequestWithDetails[];
  isLoading: boolean;
  pagination: PaginationState;
  onPageChange: (page: number) => void;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function formatTime(timeString: string) {
  if (!timeString) return "N/A";
  // timeString is in format "HH:MM:SS"
  const [hours, minutes] = timeString.split(":");
  return `${hours}:${minutes}`;
}

function formatDuration(minutes: number) {
  if (!minutes) return "0h 0m";
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${mins}m`;
}

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

export function UndertimeReportTable({
  data,
  isLoading,
  pagination,
  onPageChange,
}: UndertimeReportTableProps) {
  const [viewModalState, setViewModalState] = useState<{
    isOpen: boolean;
    data: UndertimeRequestWithDetails | null;
  }>({
    isOpen: false,
    data: null,
  });

  const handleOpenViewModal = (request: UndertimeRequestWithDetails) => {
    setViewModalState({
      isOpen: true,
      data: request,
    });
  };

  const handleCloseViewModal = () => {
    setViewModalState({
      isOpen: false,
      data: null,
    });
  };
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
            No undertime reports found
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
      <div className="rounded-md border **:data-[slot=table-container]:overflow-x-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Request Date</TableHead>
              <TableHead>Timeout</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead className="w-48">Reason</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-40">Remarks</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((request) => (
              <TableRow key={request.undertime_id}>
                {/* Name */}
                <TableCell className="font-medium">
                  {request.employee_name}
                </TableCell>

                {/* Request Date */}
                <TableCell>
                  {request.request_date
                    ? format(new Date(request.request_date), "MMM dd, yyyy")
                    : "N/A"}
                </TableCell>

                {/* Timeout */}
                <TableCell>{formatTime(request.actual_timeout)}</TableCell>

                {/* Duration */}
                <TableCell>{formatDuration(request.duration_minutes)}</TableCell>

                {/* Reason */}
                <TableCell className="max-w-48">
                  {request.reason ? (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="block truncate cursor-help">
                            {request.reason}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-md">
                          <p>{request.reason}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  ) : (
                    "N/A"
                  )}
                </TableCell>

                {/* Status */}
                <TableCell>{getStatusBadge(request.status)}</TableCell>

                {/* Remarks */}
                <TableCell className="max-w-40">
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

                {/* Action */}
                <TableCell className="text-right">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => handleOpenViewModal(request)}
                    className="border dark:border-gray-600"
                  >
                    View
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ViewDetailsModal
        isOpen={viewModalState.isOpen}
        onClose={handleCloseViewModal}
        data={viewModalState.data}
      />

      {/* Pagination Controls */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Showing {Math.min(pagination.currentPage * pagination.pageSize, pagination.totalItems)} of {pagination.totalItems} rows
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
