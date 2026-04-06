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
import type { UndertimeRequestWithUser } from "../type";
import { ApprovalModal } from "./ApprovalModal";
import { ViewDetailsModal } from "./ViewDetailsModal";

interface UndertimeTableProps {
  data: UndertimeRequestWithUser[];
  onApprove: (undertimeId: number, remarks: string) => Promise<void>;
  onReject: (undertimeId: number, remarks: string) => Promise<void>;
  onRefresh: () => Promise<void>;
  isLoading?: boolean;
}

export function UndertimeTable({
  data,
  onApprove,
  onReject,
  isLoading = false
}: UndertimeTableProps) {
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    action: "approve" | "reject" | null;
    undertimeId: number | null;
    employeeName: string;
  }>({
    isOpen: false,
    action: null,
    undertimeId: null,
    employeeName: "",
  });
  const [viewModalState, setViewModalState] = useState<{
    isOpen: boolean;
    data: UndertimeRequestWithUser | null;
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

  const formatTime = (time: string) => {
    if (!time) return "N/A";
    // Format time from HH:MM:SS to HH:MM AM/PM
    const [hours, minutes] = time.split(":");
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? "PM" : "AM";
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

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
    undertimeId: number,
    employeeName: string
  ) => {
    setModalState({
      isOpen: true,
      action,
      undertimeId,
      employeeName,
    });
  };

  const handleCloseModal = () => {
    setModalState({
      isOpen: false,
      action: null,
      undertimeId: null,
      employeeName: "",
    });
  };

  const handleOpenViewModal = (request: UndertimeRequestWithUser) => {
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
    if (!modalState.undertimeId || !modalState.action) return;

    try {
      setProcessingId(modalState.undertimeId);

      if (modalState.action === "approve") {
        await onApprove(modalState.undertimeId, remarks);
      } else {
        await onReject(modalState.undertimeId, remarks);
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
        <p className="text-muted-foreground">No pending undertime requests found.</p>
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
              <TableHead>Timeout</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>Reason</TableHead>
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

              const isProcessing = processingId === request.undertime_id;
              const durationHours = Math.floor(request.duration_minutes / 60);
              const durationMins = request.duration_minutes % 60;
              const durationDisplay = durationHours > 0
                ? `${durationHours}h ${durationMins}m`
                : `${durationMins}m`;

              return (
                <TableRow key={request.undertime_id}>
                  <TableCell className="font-medium">{fullName}</TableCell>
                  <TableCell>{formatDate(request.request_date)}</TableCell>
                  <TableCell>{formatTime(request.actual_timeout)}</TableCell>
                  <TableCell>{durationDisplay}</TableCell>
                  <TableCell className="max-w-xs truncate" title={request.reason}>
                    {request.reason}
                  </TableCell>
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
                          handleOpenModal("approve", request.undertime_id, fullName)
                        }
                        disabled={isLoading || isProcessing}
                      >
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() =>
                          handleOpenModal("reject", request.undertime_id, fullName)
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
