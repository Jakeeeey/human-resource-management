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

interface LeaveTableProps {
  data: LeaveRequestWithUser[];
  onApprove: (leaveId: number, remarks: string) => Promise<void>;
  onReject: (leaveId: number, remarks: string) => Promise<void>;
  onRefresh: () => Promise<void>;
  isLoading?: boolean;
}

export function LeaveTable({ data, onApprove, onReject, onRefresh, isLoading = false }: LeaveTableProps) {
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
  const [processingId, setProcessingId] = useState<number | null>(null);

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
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((request) => {
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
