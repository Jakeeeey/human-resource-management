"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Checkbox } from "@/components/ui/checkbox";
import type { OvertimeRequestWithUser } from "../type";

interface UserOvertimeRequestsModalProps {
  isOpen: boolean;
  onClose: () => void;
  requests: OvertimeRequestWithUser[];
  employeeName: string;
  onApprove: (overtimeIds: number[], remarks: string) => Promise<void>;
  onReject: (overtimeIds: number[], remarks: string) => Promise<void>;
  onViewDetails: (request: OvertimeRequestWithUser) => void;
  isLoading?: boolean;
}

export function UserOvertimeRequestsModal({
  isOpen,
  onClose,
  requests,
  employeeName,
  onApprove,
  onReject,
  onViewDetails,
  isLoading = false,
}: UserOvertimeRequestsModalProps) {
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const formatTime = (time: string) => {
    if (!time) return "N/A";
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

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allPendingIds = requests
        .filter((r) => r.status === "pending")
        .map((r) => r.overtime_id);
      setSelectedIds(new Set(allPendingIds));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectRow = (overtimeId: number, checked: boolean) => {
    const newSelected = new Set(selectedIds);
    if (checked) {
      newSelected.add(overtimeId);
    } else {
      newSelected.delete(overtimeId);
    }
    setSelectedIds(newSelected);
  };

  const handleBulkApprove = async () => {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    await onApprove(ids, "");
    setSelectedIds(new Set());
    // Don't close immediately here, wait for parent
  };

  const handleBulkReject = async () => {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    await onReject(ids, "");
    setSelectedIds(new Set());
    // Don't close immediately here, wait for parent
  };

  const handleClose = () => {
    setSelectedIds(new Set());
    onClose();
  };

  const pendingRequests = requests.filter((r) => r.status === "pending");
  const allSelected = pendingRequests.length > 0 && selectedIds.size === pendingRequests.length;
  const isIndeterminate = selectedIds.size > 0 && selectedIds.size < pendingRequests.length;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-[90vw] lg:max-w-5xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>Overtime Requests for {employeeName}</DialogTitle>
            <div className="flex items-center gap-2 mr-8">
              <Button
                variant="default"
                size="sm"
                onClick={handleBulkApprove}
                disabled={isLoading || selectedIds.size === 0}
              >
                Approve Selected ({selectedIds.size})
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleBulkReject}
                disabled={isLoading || selectedIds.size === 0}
              >
                Reject Selected ({selectedIds.size})
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="rounded-md border mt-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox
                    checked={allSelected ? true : isIndeterminate ? "indeterminate" : false}
                    onCheckedChange={(checked) => handleSelectAll(checked as boolean)}
                    disabled={pendingRequests.length === 0}
                  />
                </TableHead>
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
              {requests.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-6 text-muted-foreground">
                    No pending overtime requests for this user.
                  </TableCell>
                </TableRow>
              ) : (
                requests.map((request) => {
                  const durationHours = Math.floor(request.duration_minutes / 60);
                  const durationMins = request.duration_minutes % 60;
                  const durationDisplay =
                    durationHours > 0
                      ? `${durationHours}h ${durationMins}m`
                      : `${durationMins}m`;
                      
                  const isPending = request.status === "pending";

                  return (
                    <TableRow key={request.overtime_id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.has(request.overtime_id)}
                          onCheckedChange={(checked) => handleSelectRow(request.overtime_id, checked as boolean)}
                          disabled={!isPending}
                        />
                      </TableCell>
                      <TableCell>{formatDate(request.request_date)}</TableCell>
                      <TableCell>{formatTime(request.ot_from)}</TableCell>
                      <TableCell>{formatTime(request.ot_to)}</TableCell>
                      <TableCell>{durationDisplay}</TableCell>
                      <TableCell
                        className="max-w-xs truncate"
                        title={request.purpose}
                      >
                        {request.purpose}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{request.status}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => onViewDetails(request)}
                            disabled={isLoading}
                            className="border dark:border-gray-600"
                          >
                            View
                          </Button>
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => {
                              onApprove([request.overtime_id], "");
                              if (requests.length === 1) handleClose();
                            }}
                            disabled={isLoading}
                          >
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => {
                              onReject([request.overtime_id], "");
                              if (requests.length === 1) handleClose();
                            }}
                            disabled={isLoading}
                          >
                            Reject
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
}
