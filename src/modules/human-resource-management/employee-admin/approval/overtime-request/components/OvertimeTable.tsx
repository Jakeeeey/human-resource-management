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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { OvertimeRequestWithUser } from "../type";
import { ApprovalModal } from "./ApprovalModal";

interface OvertimeTableProps {
  data: OvertimeRequestWithUser[];
  onApprove: (overtimeId: number, remarks: string) => Promise<void>;
  onReject: (overtimeId: number, remarks: string) => Promise<void>;
  onRefresh: () => void;
  isLoading?: boolean;
}

export function OvertimeTable({ data, onApprove, onReject, onRefresh, isLoading = false }: OvertimeTableProps) {
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    action: "approve" | "reject" | null;
    overtimeId: number | null;
    employeeName: string;
  }>({
    isOpen: false,
    action: null,
    overtimeId: null,
    employeeName: "",
  });
  const [processingId, setProcessingId] = useState<number | null>(null);

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
    overtimeId: number,
    employeeName: string
  ) => {
    setModalState({
      isOpen: true,
      action,
      overtimeId,
      employeeName,
    });
  };

  const handleCloseModal = () => {
    setModalState({
      isOpen: false,
      action: null,
      overtimeId: null,
      employeeName: "",
    });
  };

  const handleConfirm = async (remarks: string) => {
    if (!modalState.overtimeId || !modalState.action) return;

    try {
      setProcessingId(modalState.overtimeId);
      
      if (modalState.action === "approve") {
        await onApprove(modalState.overtimeId, remarks);
      } else {
        await onReject(modalState.overtimeId, remarks);
      }
      
      handleCloseModal();
    } catch (error) {
      console.error("Error processing request:", error);
    } finally {
      setProcessingId(null);
    }
  };

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-4">
          <div className="space-y-1">
            <CardTitle className="text-2xl font-bold">Overtime Report</CardTitle>
            <p className="text-sm text-muted-foreground">
              View overtime requests for your department
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={isLoading}
            className="gap-2"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
            </svg>
            Refresh
          </Button>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-muted-foreground">No pending overtime requests found.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-4">
          <div className="space-y-1">
            <CardTitle className="text-2xl font-bold">Overtime Report</CardTitle>
            <p className="text-sm text-muted-foreground">
              View overtime requests for your department
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={isLoading}
            className="gap-2"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
            </svg>
            Refresh
          </Button>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Request Date</TableHead>
                  <TableHead>From</TableHead>
                  <TableHead>To</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Purpose</TableHead>
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
                  
                  const isProcessing = processingId === request.overtime_id;
                  const durationHours = Math.floor(request.duration_minutes / 60);
                  const durationMins = request.duration_minutes % 60;
                  const durationDisplay = durationHours > 0 
                    ? `${durationHours}h ${durationMins}m` 
                    : `${durationMins}m`;

                  return (
                    <TableRow key={request.overtime_id}>
                      <TableCell className="font-medium">{fullName}</TableCell>
                      <TableCell>{formatDate(request.request_date)}</TableCell>
                      <TableCell>{formatTime(request.ot_from)}</TableCell>
                      <TableCell>{formatTime(request.ot_to)}</TableCell>
                      <TableCell>{durationDisplay}</TableCell>
                      <TableCell className="max-w-xs truncate" title={request.purpose}>
                        {request.purpose}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{request.status}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() =>
                              handleOpenModal("approve", request.overtime_id, fullName)
                            }
                            disabled={isLoading || isProcessing}
                          >
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() =>
                              handleOpenModal("reject", request.overtime_id, fullName)
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
        </CardContent>
      </Card>

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
