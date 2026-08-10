"use client";

import React, { useState } from "react";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { FileText, ArrowRight, Download, Check, X, Loader2 } from "lucide-react";
import type { AttendanceChangeRequestWithUser, AttendanceChangeRequestFile } from "../type";
import { approveOrRejectModification } from "../providers/fetchProvider";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  request: AttendanceChangeRequestWithUser | null;
  onSuccess: () => void;
}

export function ModificationReviewDialog({ open, onOpenChange, request, onSuccess }: Props) {
  const [remarks, setRemarks] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  if (!request) return null;

  const handleAction = async (status: 'approved' | 'rejected') => {
    try {
      setIsProcessing(true);
      await approveOrRejectModification(request.id, status, remarks);
      toast.success(`Request ${status} successfully`);
      onSuccess();
      onOpenChange(false);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      toast.error(errorMessage || `Failed to ${status} request`);
    } finally {
      setIsProcessing(false);
    }
  };

  const formatTime = (timeString?: string | null) => {
    if (!timeString) return "--:--";
    
    if (timeString.includes("T")) {
      const date = new Date(timeString);
      if (isNaN(date.getTime())) return "--:--";
      return format(date, "hh:mm a");
    }
    
    const [hours, minutes] = timeString.split(":");
    if (hours && minutes) {
      const h = parseInt(hours, 10);
      if (isNaN(h)) return "--:--";
      const ampm = h >= 12 ? "PM" : "AM";
      const h12 = h % 12 || 12;
      return `${h12.toString().padStart(2, "0")}:${minutes} ${ampm}`;
    }

    return "--:--";
  };

  const TimeComparison = ({ label, oldTime, newTime }: { label: string, oldTime?: string | null, newTime?: string | null }) => {
    if (!newTime && !oldTime) return null;
    
    return (
      <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50 border border-border/50">
        <span className="text-sm font-semibold text-muted-foreground w-1/3">{label}</span>
        <div className="flex items-center gap-3 flex-1 justify-end">
          <span className="text-sm font-medium line-through text-muted-foreground/70">
            {formatTime(oldTime)}
          </span>
          <ArrowRight className="h-4 w-4 text-primary/50" />
          <span className="text-sm font-bold text-primary">
            {formatTime(newTime)}
          </span>
        </div>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden border-none shadow-2xl">
        <DialogHeader className="p-6 pb-0">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 bg-primary/10 rounded-xl">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-xl">Review Modification</DialogTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Requested by <span className="font-semibold text-foreground">{request.user_fname} {request.user_lname}</span> for {request.log_date}
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
          {/* Reason Section */}
          <div className="space-y-2">
            <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Reason</h3>
            <div className="p-4 bg-muted/30 rounded-xl border border-border/50 text-sm">
              {request.reason || "No reason provided."}
            </div>
          </div>

          {/* Time Changes */}
          <div className="space-y-2">
            <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Requested Changes</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <TimeComparison label="Time In" oldTime={request.old_time_in} newTime={request.time_in} />
              <TimeComparison label="Lunch Start" oldTime={request.old_lunch_start} newTime={request.lunch_start} />
              <TimeComparison label="Lunch End" oldTime={request.old_lunch_end} newTime={request.lunch_end} />
              <TimeComparison label="Break Start" oldTime={request.old_break_start} newTime={request.break_start} />
              <TimeComparison label="Break End" oldTime={request.old_break_end} newTime={request.break_end} />
              <TimeComparison label="Time Out" oldTime={request.old_time_out} newTime={request.time_out} />
            </div>
          </div>

          {/* Proofs Section */}
          {request.attendance_change_request_files && request.attendance_change_request_files.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Attached Proofs</h3>
              <div className="flex flex-wrap gap-3">
                {request.attendance_change_request_files.map((file: AttendanceChangeRequestFile) => {
                  const fileData = typeof file.directus_files_id === 'object' 
                    ? file.directus_files_id 
                    : { id: file.directus_files_id, filename_download: 'Attachment' };
                  
                  const fileUrl = `${process.env.NEXT_PUBLIC_API_BASE_URL}/assets/${fileData.id}`;
                  
                  return (
                    <a 
                      key={file.id} 
                      href={fileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-2 p-3 bg-muted/30 hover:bg-primary/5 hover:border-primary/30 border border-border/50 rounded-xl transition-all group"
                    >
                      <Download className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                      <span className="text-sm font-medium">{fileData.filename_download}</span>
                    </a>
                  );
                })}
              </div>
            </div>
          )}

          {/* Remarks Input */}
          <div className="space-y-2">
            <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Remarks (Optional)</h3>
            <Textarea 
              placeholder="Add notes for the employee..."
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              className="resize-none rounded-xl"
              rows={3}
            />
          </div>
        </div>

        {/* Action Footer */}
        <div className="p-6 pt-0 flex items-center justify-end gap-3">
          <Button 
            variant="outline" 
            onClick={() => handleAction('rejected')}
            disabled={isProcessing}
            className="rounded-xl border-destructive/30 text-destructive hover:bg-destructive/10"
          >
            {isProcessing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <X className="h-4 w-4 mr-2" />}
            Reject
          </Button>
          <Button 
            onClick={() => handleAction('approved')}
            disabled={isProcessing}
            className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {isProcessing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
            Approve Request
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
