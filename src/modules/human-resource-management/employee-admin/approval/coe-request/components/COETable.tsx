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
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

import type { COERequestWithUser } from "../type";
import { ViewDetailsModal } from "./ViewDetailsModal";

interface COETableProps {
  data: COERequestWithUser[];
  onApprove: (coeId: number, remarks: string) => Promise<void>;
  onReject: (coeId: number, remarks: string) => Promise<void>;
  onEditRemarks: (coeId: number, hr_remarks: string) => Promise<void>;
  isLoading?: boolean;
}

export function COETable({ data, onApprove, onReject, onEditRemarks, isLoading = false }: COETableProps) {
  const [viewModalState, setViewModalState] = useState<{
    isOpen: boolean;
    data: COERequestWithUser | null;
  }>({
    isOpen: false,
    data: null,
  });
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const totalItems = data.length;
  const totalPages = Math.ceil(totalItems / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const displayedData = data.slice(startIndex, endIndex);

  const formatDate = (date: string) => {
    if (!date) return "N/A";
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const handleOpenViewModal = (request: COERequestWithUser) => {
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
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-muted-foreground">No COE requests found.</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Request Date</TableHead>
                <TableHead>Purpose</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayedData.map((request) => {
                const fullName = [
                  request.user_fname,
                  request.user_mname,
                  request.user_lname,
                ]
                  .filter(Boolean)
                  .join(" ");

                return (
                  <TableRow key={request.id}>
                    <TableCell className="font-medium">{fullName}</TableCell>
                    <TableCell>{formatDate(request.request_date)}</TableCell>
                    <TableCell className="max-w-[200px] truncate" title={request.purpose}>
                      {request.purpose?.length > 50 ? `${request.purpose.slice(0, 50)}...` : request.purpose}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          request.status === "REJECTED" ? "destructive"
                          : "secondary"
                        }
                        className={
                          request.status === "PENDING"
                            ? "bg-amber-500 dark:bg-amber-600 text-white hover:bg-amber-500/80 dark:hover:bg-amber-600/80"
                            : request.status === "APPROVED"
                            ? "bg-blue-600 dark:bg-blue-500 text-white hover:bg-blue-600/80 dark:hover:bg-blue-500/80"
                            : request.status === "RELEASED"
                            ? "bg-emerald-600 dark:bg-emerald-500 text-white hover:bg-emerald-600/80 dark:hover:bg-emerald-500/80"
                            : "capitalize"
                        }
                      >
                        {request.status.toLowerCase()}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handleOpenViewModal(request)}
                          disabled={isLoading}
                          className="border dark:border-gray-600"
                        >
                          View
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        {totalPages > 0 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Showing {Math.min(currentPage * pageSize, totalItems)} of {totalItems} rows
            </p>
            {totalPages > 1 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    if (currentPage > 1) {
                      setCurrentPage(currentPage - 1);
                    }
                  }}
                  disabled={currentPage === 1}
                  className="px-3 py-2 text-sm border rounded hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <button
                  onClick={() => {
                    if (currentPage < totalPages) {
                      setCurrentPage(currentPage + 1);
                    }
                  }}
                  disabled={currentPage === totalPages}
                  className="px-3 py-2 text-sm border rounded hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <ViewDetailsModal
        isOpen={viewModalState.isOpen}
        onClose={handleCloseViewModal}
        data={viewModalState.data}
        onApprove={onApprove}
        onReject={onReject}
        onEditRemarks={onEditRemarks}
      />
    </>
  );
}
