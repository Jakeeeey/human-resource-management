"use client";

import React, { useState } from "react";
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
import { FileEdit, Inbox } from "lucide-react";
import type { AttendanceChangeRequestWithUser } from "../type";
import { ModificationReviewDialog } from "./ModificationReviewDialog";

interface Props {
  data: AttendanceChangeRequestWithUser[];
  isLoading: boolean;
  onRefresh: () => void;
}

export function AttendanceModificationTable({ data, isLoading, onRefresh }: Props) {
  const [selectedRequest, setSelectedRequest] = useState<AttendanceChangeRequestWithUser | null>(null);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return <Badge className="bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 border-emerald-500/20">Approved</Badge>;
      case "rejected":
        return <Badge className="bg-destructive/10 text-destructive hover:bg-destructive/20 border-destructive/20">Rejected</Badge>;
      default:
        return <Badge className="bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 border-amber-500/20">Pending</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="h-64 flex flex-col items-center justify-center text-muted-foreground animate-pulse">
        <div className="h-8 w-8 rounded-full border-4 border-primary/20 border-t-primary animate-spin mb-4" />
        <p className="font-medium">Loading requests...</p>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="h-64 flex flex-col items-center justify-center text-muted-foreground">
        <div className="p-4 bg-muted/50 rounded-full mb-3">
          <Inbox className="h-8 w-8 text-muted-foreground/50" />
        </div>
        <p className="font-medium text-lg text-foreground">No Requests Found</p>
        <p className="text-sm">There are no attendance modification requests at this time.</p>
      </div>
    );
  }

  return (
    <>
      <div className="w-full overflow-auto">
        <Table>
          <TableHeader className="bg-muted/30 sticky top-0 backdrop-blur-sm z-10">
            <TableRow className="hover:bg-transparent">
              <TableHead className="font-bold whitespace-nowrap">Employee</TableHead>
              <TableHead className="font-bold whitespace-nowrap">Log Date</TableHead>
              <TableHead className="font-bold min-w-[200px]">Reason</TableHead>
              <TableHead className="font-bold whitespace-nowrap">Status</TableHead>
              <TableHead className="font-bold text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((req) => (
              <TableRow 
                key={req.id}
                className="group hover:bg-muted/30 transition-colors"
              >
                <TableCell>
                  <div className="font-semibold text-foreground">
                    {req.user_fname} {req.user_lname}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {req.department_name || "No Department"}
                  </div>
                </TableCell>
                <TableCell className="font-medium whitespace-nowrap">
                  {req.log_date}
                </TableCell>
                <TableCell>
                  <p className="text-sm text-muted-foreground line-clamp-2 max-w-md">
                    {req.reason}
                  </p>
                </TableCell>
                <TableCell>
                  {getStatusBadge(req.status)}
                </TableCell>
                <TableCell className="text-right">
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => setSelectedRequest(req)}
                    className="rounded-xl hover:bg-primary/10 hover:text-primary transition-colors font-medium text-sm gap-2"
                  >
                    <FileEdit className="h-4 w-4" />
                    Review
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ModificationReviewDialog 
        open={!!selectedRequest}
        onOpenChange={(open) => !open && setSelectedRequest(null)}
        request={selectedRequest}
        onSuccess={onRefresh}
      />
    </>
  );
}
