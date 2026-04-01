"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import type { LeaveRequestWithDetails } from "../type";

interface ViewDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: LeaveRequestWithDetails | null;
}

export function ViewDetailsModal({ isOpen, onClose, data }: ViewDetailsModalProps) {
  if (!data) return null;

  const formatDate = (date: string) => {
    if (!date) return "N/A";
    return format(new Date(date), "MMM dd, yyyy");
  };

  const getStatusBadge = (status: string) => {
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
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Leave Request Details</DialogTitle>
          <DialogDescription>
            Complete details for the leave request
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Employee Information */}
          <div className="space-y-3 border-b pb-4">
            <h3 className="font-semibold text-sm">Employee Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Full Name</p>
                <p className="font-medium">{data.employee_name}</p>
              </div>
            </div>
          </div>

          {/* Request Details */}
          <div className="space-y-3 border-b pb-4">
            <h3 className="font-semibold text-sm">Request Details</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Request Date</p>
                <p className="font-medium">{formatDate(data.filed_at)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Leave Type</p>
                <p className="font-medium capitalize">{data.leave_type}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Status</p>
                {getStatusBadge(data.status)}
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Days</p>
                <p className="font-medium">{data.total_days}</p>
              </div>
            </div>
          </div>

          {/* Leave Period */}
          <div className="space-y-3 border-b pb-4">
            <h3 className="font-semibold text-sm">Leave Period</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Start Date</p>
                <p className="font-medium">{formatDate(data.leave_start)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">End Date</p>
                <p className="font-medium">{formatDate(data.leave_end)}</p>
              </div>
            </div>
          </div>

          {/* Purpose and Remarks */}
          <div className="space-y-3">
            <div>
              <p className="text-xs text-muted-foreground mb-2">Reason</p>
              <p className="font-medium text-sm bg-muted p-2 rounded whitespace-pre-wrap break-all overflow-hidden">
                {data.reason || "N/A"}
              </p>
            </div>
            {data.remarks && (
              <div>
                <p className="text-xs text-muted-foreground mb-2">Remarks</p>
                <p className="font-medium text-sm bg-muted p-2 rounded whitespace-pre-wrap break-all overflow-hidden">
                  {data.remarks}
                </p>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
