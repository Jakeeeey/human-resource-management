"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, History, Calendar, CheckCircle, Clock } from "lucide-react";
import { LguLeaveRequest, CSC_LEAVE_TYPES } from "../types";

interface LguLeaveApprovalTableProps {
  requests: LguLeaveRequest[];
  onReview: (request: LguLeaveRequest) => void;
  onViewHistory: (request: LguLeaveRequest) => void;
}

export function LguLeaveApprovalTable({
  requests,
  onReview,
  onViewHistory,
}: LguLeaveApprovalTableProps) {
  if (requests.length === 0) {
    return (
      <div className="border rounded-lg p-12 text-center bg-card">
        <FileText className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-40" />
        <h4 className="text-sm font-semibold text-foreground">No LGU Leave Applications Found</h4>
        <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
          There are currently no CSC Form No. 6 leave requests matching your approval permissions or search filters.
        </p>
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return (
          <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 uppercase text-[10px] tracking-wider font-bold">
            Approved
          </Badge>
        );
      case "recommended":
        return (
          <Badge className="bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30 uppercase text-[10px] tracking-wider font-bold">
            Recommended
          </Badge>
        );
      case "disapproved":
        return (
          <Badge className="bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30 uppercase text-[10px] tracking-wider font-bold">
            Disapproved
          </Badge>
        );
      case "pending":
      default:
        return (
          <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30 uppercase text-[10px] tracking-wider font-bold">
            Pending Review
          </Badge>
        );
    }
  };

  return (
    <div className="border rounded-lg overflow-hidden bg-card shadow-xs">
      <Table>
        <TableHeader>
          <tr className="bg-muted/50 border-b">
            <TableHead className="w-16 text-xs font-semibold">ID</TableHead>
            <TableHead className="text-xs font-semibold">Employee / Office</TableHead>
            <TableHead className="text-xs font-semibold">Leave Type</TableHead>
            <TableHead className="text-xs font-semibold">Inclusive Dates & Days</TableHead>
            <TableHead className="text-xs font-semibold">Approval Level</TableHead>
            <TableHead className="text-xs font-semibold">Status</TableHead>
            <TableHead className="text-xs font-semibold text-right pr-4">Action</TableHead>
          </tr>
        </TableHeader>
        <TableBody>
          {requests.map((req) => {
            const leaveConfig = CSC_LEAVE_TYPES.find((t) => t.code === req.leave_type);
            const isActionable = req.can_approve ?? (req.status === "pending" || req.status === "recommended");

            return (
              <TableRow key={req.id} className="hover:bg-muted/30 transition-colors">
                {/* ID & Date */}
                <TableCell className="font-mono text-xs text-muted-foreground">
                  <div className="font-semibold text-foreground">#{req.id}</div>
                  <div className="text-[10px]">{req.date_of_filing}</div>
                </TableCell>

                {/* Employee / Office */}
                <TableCell>
                  <div className="font-medium text-xs text-foreground">
                    {req.last_name}, {req.first_name} {req.middle_name || ""}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {req.position}
                  </div>
                  <div className="text-[10px] text-muted-foreground font-mono">
                    {req.office_department}
                  </div>
                </TableCell>

                {/* Leave Type */}
                <TableCell>
                  <div className="text-xs font-semibold text-foreground">
                    {leaveConfig?.title || req.leave_type}
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                      {leaveConfig?.category || "CSC Leave"}
                    </Badge>
                    {req.commutation_requested && (
                      <Badge variant="secondary" className="text-[9px] px-1 py-0">
                        Commutation
                      </Badge>
                    )}
                  </div>
                </TableCell>

                {/* Dates & Working Days */}
                <TableCell>
                  <div className="text-xs font-medium text-foreground flex items-center gap-1">
                    <Calendar className="h-3 w-3 text-muted-foreground" />
                    <span>{req.start_date} to {req.end_date}</span>
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    <span className="font-semibold text-foreground">{req.working_days_applied}</span>{" "}
                    {req.working_days_applied === 1 ? "working day" : "working days"}
                  </div>
                </TableCell>

                {/* Approval Level */}
                <TableCell>
                  <div className="space-y-1">
                    <div className="flex items-center gap-1 text-xs">
                      {req.status === "approved" ? (
                        <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
                      ) : (
                        <Clock className="h-3.5 w-3.5 text-primary" />
                      )}
                      <span className="font-medium text-xs">
                        Level {req.current_approval_level} of {req.total_levels || 2}
                      </span>
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      {req.current_approval_level === 1
                        ? "Supervisor Recommendation"
                        : req.current_approval_level === 2 && req.total_levels === 3
                        ? "HRMO Certification"
                        : "Executive / Mayoral Action"}
                    </div>
                  </div>
                </TableCell>

                {/* Status */}
                <TableCell>{getStatusBadge(req.status)}</TableCell>

                {/* Actions */}
                <TableCell className="text-right pr-4">
                  <div className="flex items-center justify-end gap-1.5">
                    <Button
                      variant={isActionable ? "default" : "outline"}
                      size="sm"
                      onClick={() => onReview(req)}
                      className={`h-7 text-xs px-2.5 gap-1 ${
                        isActionable
                          ? "bg-primary text-primary-foreground hover:bg-primary/90"
                          : ""
                      }`}
                    >
                      <FileText className="h-3.5 w-3.5" />
                      {isActionable ? "Review Form 6" : "View Form 6"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onViewHistory(req)}
                      title="View Approval Audit Trail"
                      className="h-7 w-7 p-0"
                    >
                      <History className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
