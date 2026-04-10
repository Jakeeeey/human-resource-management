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
import type { LeaveRequestWithUser } from "../type";
import { ApprovalModal } from "./ApprovalModal";
import { ViewDetailsModal } from "./ViewDetailsModal";

interface LeaveTableProps {
  data: LeaveRequestWithUser[];
  onApprove: (leaveId: number, remarks: string) => Promise<void>;
  onReject: (leaveId: number, remarks: string) => Promise<void>;
  onRefresh: () => Promise<void>;
  isLoading?: boolean;
}

export function LeaveTable({ data, onApprove, onReject, isLoading = false }: LeaveTableProps) {
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    action: "approve" | "reject" | null;
    leaveId: number | null;
    employeeName: string;
  }>({
    isOpen: false,
    action: null,
    leaveId: null,
    employeeName: "",
  });
  const [viewModalState, setViewModalState] = useState<{
    isOpen: boolean;
    data: LeaveRequestWithUser | null;
  }>({
    isOpen: false,
    data: null,
  });
  const [processingId, setProcessingId] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Calculate pagination
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

  const handleOpenModal = (
    action: "approve" | "reject",
    leaveId: number,
    employeeName: string
  ) => {
    setModalState({
      isOpen: true,
      action,
      leaveId,
      employeeName,
    });
  };

  const handleCloseModal = () => {
    setModalState({
      isOpen: false,
      action: null,
      leaveId: null,
      employeeName: "",
    });
  };

  const handleOpenViewModal = (request: LeaveRequestWithUser) => {
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

  const handleConfirm = async (remarks: string) => {
    if (!modalState.leaveId || !modalState.action) return;

    try {
      setProcessingId(modalState.leaveId);

      if (modalState.action === "approve") {
        await onApprove(modalState.leaveId, remarks);
      } else {
        await onReject(modalState.leaveId, remarks);
      }

      handleCloseModal();
    } catch (error) {
      console.error("Error processing request:", error);
    } finally {
      setProcessingId(null);
    }
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
        <p className="text-muted-foreground">No pending leave requests found.</p>
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
                <TableHead>From</TableHead>
                <TableHead>To</TableHead>
                <TableHead>Days</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Type</TableHead>
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

              const isProcessing = processingId === request.leave_id;

              return (
                <TableRow key={request.leave_id}>
                  <TableCell className="font-medium">{fullName}</TableCell>
                  <TableCell>{formatDate(request.filed_at)}</TableCell>
                  <TableCell>{formatDate(request.leave_start)}</TableCell>
                  <TableCell>{formatDate(request.leave_end)}</TableCell>
                  <TableCell>{request.total_days}</TableCell>
                  <TableCell className="max-w-xs truncate" title={request.reason}>
                    {request.reason}
                  </TableCell>
                  <TableCell className="capitalize">{request.leave_type}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{request.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleOpenViewModal(request)}
                        disabled={isLoading || isProcessing}
                        className="border dark:border-gray-600"
                      >
                        View
                      </Button>
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() =>
                          handleOpenModal("approve", request.leave_id, fullName)
                        }
                        disabled={isLoading || isProcessing}
                      >
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() =>
                          handleOpenModal("reject", request.leave_id, fullName)
                        }
                        disabled={isLoading || isProcessing}
                      >
                        Reject
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Pagination Controls */}
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
      />

      <ApprovalModal
        isOpen={modalState.isOpen}
        onClose={handleCloseModal}
        onConfirm={handleConfirm}
        action={modalState.action}
        employeeName={modalState.employeeName}
        isLoading={processingId !== null}
      />
    </>
  );
}
