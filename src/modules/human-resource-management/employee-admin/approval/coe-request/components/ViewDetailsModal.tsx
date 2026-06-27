"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { ExternalLink } from "lucide-react";
import type { COERequestWithUser } from "../type";

interface ViewDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: COERequestWithUser | null;
}

export function ViewDetailsModal({ isOpen, onClose, data }: ViewDetailsModalProps) {
  if (!data) return null;

  const fullName = [data.user_fname, data.user_mname, data.user_lname]
    .filter(Boolean)
    .join(" ");

  const formatDate = (date: string) => {
    if (!date) return "N/A";
    return format(new Date(date), "MMM dd, yyyy");
  };

  const statusVariant =
    data.status === "APPROVED" ? "outline"
    : data.status === "REJECTED" ? "destructive"
    : "secondary";

  const statusClass =
    data.status === "APPROVED"
      ? "text-emerald-600 dark:text-emerald-400 border-emerald-300 dark:border-emerald-700"
      : "capitalize";

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>COE Request Details</DialogTitle>
          <DialogDescription>
            Complete details for the Certificate of Employment request
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-3 border-b pb-4">
            <h3 className="font-semibold text-sm">Employee Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Full Name</p>
                <p className="font-medium">{fullName}</p>
              </div>
            </div>
          </div>

          <div className="space-y-3 border-b pb-4">
            <h3 className="font-semibold text-sm">Request Details</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Request Date</p>
                <p className="font-medium">{formatDate(data.request_date)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Status</p>
                <Badge variant={statusVariant as "secondary" | "destructive" | "outline"} className={statusClass}>
                  {data.status.toLowerCase()}
                </Badge>
              </div>
              {data.approval_date && (
                <div>
                  <p className="text-xs text-muted-foreground">Approval Date</p>
                  <p className="font-medium">{formatDate(data.approval_date)}</p>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-3 border-b pb-4">
            <h3 className="font-semibold text-sm">Purpose</h3>
            <p className="font-medium text-sm bg-muted p-2 rounded whitespace-pre-wrap break-all overflow-hidden">
              {data.purpose || "N/A"}
            </p>
          </div>

          {data.hr_remarks && (
            <div className="space-y-3 border-b pb-4">
              <h3 className="font-semibold text-sm">HR Remarks</h3>
              <p className="font-medium text-sm bg-muted p-2 rounded whitespace-pre-wrap break-all overflow-hidden">
                {data.hr_remarks}
              </p>
            </div>
          )}

          {data.ecopy_file_url && (
            <div className="space-y-3">
              <h3 className="font-semibold text-sm">E-Copy</h3>
              <Button variant="outline" size="sm" asChild>
                <a href={data.ecopy_file_url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  View E-Copy
                </a>
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
