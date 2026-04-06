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
import type { UndertimeRequestWithDetails } from "../type";

interface ViewDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: UndertimeRequestWithDetails | null;
}

export function ViewDetailsModal({ isOpen, onClose, data }: ViewDetailsModalProps) {
  if (!data) return null;

  const formatDate = (date: string) => {
    if (!date) return "N/A";
    return format(new Date(date), "MMM dd, yyyy");
  };

  const formatTime = (time: string) => {
    if (!time) return "N/A";
    const [hours, minutes] = time.split(":");
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? "PM" : "AM";
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const durationHours = Math.floor(data.duration_minutes / 60);
  const durationMins = data.duration_minutes % 60;
  const durationDisplay = durationHours > 0
    ? `${durationHours}h ${durationMins}m`
    : `${durationMins}m`;

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
          <DialogTitle>Undertime Request Details</DialogTitle>
          <DialogDescription>
            Complete details for the undertime request
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
              {data.department?.department_name && (
                <div>
                  <p className="text-xs text-muted-foreground">Department</p>
                  <p className="font-medium">{data.department.department_name}</p>
                </div>
              )}
            </div>
          </div>

          {/* Request Details */}
          <div className="space-y-3 border-b pb-4">
            <h3 className="font-semibold text-sm">Request Details</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Request Date</p>
                <p className="font-medium">{formatDate(data.request_date)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Status</p>
                {getStatusBadge(data.status)}
              </div>
            </div>
          </div>

          {/* Undertime Details */}
          <div className="space-y-3 border-b pb-4">
            <h3 className="font-semibold text-sm">Undertime Details</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Scheduled Timeout</p>
                <p className="font-medium">{formatTime(data.sched_timeout)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Actual Timeout</p>
                <p className="font-medium">{formatTime(data.actual_timeout)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Duration</p>
                <p className="font-medium">{durationDisplay}</p>
              </div>
            </div>
          </div>

          {/* Reason and Remarks */}
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
