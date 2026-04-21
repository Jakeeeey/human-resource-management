"use client";

import React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AnyTARequest, TAActionPayload, HistoryLog, UserDetails, LeaveRequest, RequestType } from "../types";
import { 
  CheckCircle2, 
  XCircle, 
  RotateCcw, 
  Calendar, 
  Clock, 
  User, 
  FileText,
  Info
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { TAHistoryTimeline } from "./TAHistoryTimeline";

interface AttendanceApprovalTableProps {
  data: AnyTARequest[];
  onAction: (payload: TAActionPayload) => Promise<boolean>;
  fetchHistory: (requestId: number, type: string) => Promise<HistoryLog[]>;
  isLoading?: boolean;
}

export function AttendanceApprovalTable({ data, onAction, fetchHistory, isLoading }: AttendanceApprovalTableProps) {
  const [selectedRequest, setSelectedRequest] = React.useState<{ id: number; type: string; item: AnyTARequest } | null>(null);
  const [logs, setLogs] = React.useState<HistoryLog[]>([]);
  const [isLogsLoading, setIsLogsLoading] = React.useState(false);

  const handleShowHistory = async (requestId: number, type: string, item: AnyTARequest) => {
    setSelectedRequest({ id: requestId, type, item });
    setIsLogsLoading(true);
    const history = await fetchHistory(requestId, type);
    setLogs(history);
    setIsLogsLoading(false);
  };
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20';
      case 'rejected': return 'bg-destructive/10 text-destructive border-destructive/20';
      case 'returned': return 'bg-amber-500/10 text-amber-600 border-amber-500/20';
      default: return 'bg-primary/10 text-primary border-primary/20';
    }
  };

  const getRequestTypeBadge = (type: string) => {
    switch (type) {
      case 'leave': return <Badge variant="outline" className="bg-blue-50 text-blue-600 border-blue-200">Leave</Badge>;
      case 'overtime': return <Badge variant="outline" className="bg-purple-50 text-purple-600 border-purple-200">OT</Badge>;
      case 'undertime': return <Badge variant="outline" className="bg-orange-50 text-orange-600 border-orange-200">UT</Badge>;
      default: return null;
    }
  };

  const renderDetails = (item: AnyTARequest) => {
    if ('leave_type' in item) {
      return (
        <div className="flex flex-col gap-1">
          <span className="font-bold text-foreground/90 capitalize">{item.leave_type} Leave</span>
          <span className="text-[11px] text-muted-foreground flex items-center gap-1 font-medium">
            <Calendar className="h-3 w-3" /> {item.leave_start} to {item.leave_end}
          </span>
        </div>
      );
    }
    if ('ot_from' in item) {
      return (
        <div className="flex flex-col gap-1">
          <span className="font-bold text-foreground/90">Overtime Request</span>
          <span className="text-[11px] text-muted-foreground flex items-center gap-1 font-medium">
            <Clock className="h-3 w-3" /> {item.ot_from} - {item.ot_to} ({item.duration_minutes}m)
          </span>
        </div>
      );
    }
    if ('actual_timeout' in item) {
      return (
        <div className="flex flex-col gap-1">
          <span className="font-bold text-foreground/90">Undertime Request</span>
          <span className="text-[11px] text-muted-foreground flex items-center gap-1 font-medium">
            <Clock className="h-3 w-3" /> Sch: {item.sched_timeout} | Act: {item.actual_timeout}
          </span>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="rounded-2xl border border-muted-foreground/10 overflow-hidden bg-card shadow-sm">
      <Table>
        <TableHeader className="bg-muted/30">
          <TableRow className="hover:bg-transparent border-muted-foreground/10">
            <TableHead className="font-bold py-5 px-6 uppercase text-[10px] tracking-widest text-muted-foreground">Requester</TableHead>
            <TableHead className="font-bold py-5 uppercase text-[10px] tracking-widest text-muted-foreground">Request Details</TableHead>
            <TableHead className="font-bold py-5 uppercase text-[10px] tracking-widest text-muted-foreground">Progress</TableHead>
            <TableHead className="font-bold py-5 uppercase text-[10px] tracking-widest text-muted-foreground">Status</TableHead>
            <TableHead className="w-[200px] py-5 pr-6 text-right uppercase text-[10px] tracking-widest text-muted-foreground">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="h-48 text-center">
                <div className="flex flex-col items-center justify-center opacity-40">
                  <FileText className="h-10 w-10 mb-2" />
                  <p className="font-bold">No requests found</p>
                </div>
              </TableCell>
            </TableRow>
          ) : (
            data.map((item) => {
              const requestId = 'leave_id' in item ? item.leave_id : ('overtime_id' in item ? item.overtime_id : item.undertime_id);
              const type = 'leave_id' in item ? 'leave' : ('overtime_id' in item ? 'overtime' : 'undertime');
              const requester = item.user_id as UserDetails;

              return (
                <TableRow key={`${type}-${requestId}`} className="group hover:bg-muted/20 transition-colors border-muted-foreground/5">
                  <TableCell className="py-5 px-6">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-xl bg-muted/50 text-muted-foreground ring-1 ring-black/5">
                        <User className="h-4 w-4" />
                      </div>
                      <div className="flex flex-col">
                        <span className="font-bold text-foreground/90 leading-none">
                          {requester?.user_fname ? `${requester.user_fname} ${requester.user_lname}` : `User ID: ${item.user_id}`}
                        </span>
                        <span className="text-[10px] text-muted-foreground mt-1 uppercase font-extrabold tracking-tight">
                          {requester?.user_fname ? (requester.user_position || "Employee") : "System User"}
                        </span>
                        {(item.attachment_uuid || (item as LeaveRequest).attatchment_uuid) && (
                          <div className="flex items-center gap-1 mt-1.5 text-sky-600 font-bold text-[9px] uppercase tracking-tighter">
                            <FileText className="h-3 w-3" />
                            File Attached
                          </div>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="py-5">
                    <div className="flex flex-col gap-2">
                       <div className="flex gap-2 items-center">
                         {getRequestTypeBadge(type)}
                       </div>
                       {renderDetails(item)}
                    </div>
                  </TableCell>
                  <TableCell className="py-5">
                    <div className="flex flex-col gap-1.5">
                      <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                        Level {item.current_approval_level}
                      </div>
                      <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden border border-black/5">
                        <div 
                          className="h-full bg-primary transition-all duration-500" 
                          style={{ width: `${(item.current_approval_level / (item.total_levels || 3)) * 100}%` }} 
                        />
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="py-5">
                    <Badge 
                      variant="outline" 
                      className={cn(
                        "rounded-lg px-2.5 py-0.5 font-bold uppercase text-[10px] tracking-wider cursor-pointer hover:shadow-md transition-all active:scale-95", 
                        getStatusColor(item.status)
                      )}
                      onClick={() => handleShowHistory(requestId, type, item)}
                    >
                      {item.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="py-5 pr-6 text-right">
                    {item.status === 'pending' && (
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-9 w-9 rounded-xl hover:bg-emerald-50 text-emerald-600 hover:text-emerald-700 transition-all border border-transparent hover:border-emerald-200"
                          onClick={() => onAction({ requestId, type: type as RequestType, action: 'approve', remarks: '' })}
                          disabled={isLoading}
                        >
                          <CheckCircle2 className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-9 w-9 rounded-xl hover:bg-amber-50 text-amber-600 hover:text-amber-700 transition-all border border-transparent hover:border-amber-200"
                          onClick={() => onAction({ requestId, type: type as RequestType, action: 'return', remarks: '' })}
                          disabled={isLoading}
                        >
                          <RotateCcw className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-9 w-9 rounded-xl hover:bg-destructive/10 text-destructive hover:text-destructive/90 transition-all border border-transparent hover:border-destructive/20"
                          onClick={() => onAction({ requestId, type: type as "leave" | "overtime" | "undertime", action: 'reject', remarks: '' })}
                          disabled={isLoading}
                        >
                          <XCircle className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
      <Sheet open={!!selectedRequest} onOpenChange={(open) => !open && setSelectedRequest(null)}>
        <SheetContent className="w-full sm:max-w-md p-0 overflow-y-auto border-l-0 shadow-2xl">
          <div className="h-40 bg-primary/5 border-b border-primary/10 flex items-end px-8 pb-8">
            <SheetHeader className="p-0 text-left">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-3 bg-primary/10 rounded-2xl text-primary shadow-inner border border-primary/20">
                  <Info className="h-6 w-6" />
                </div>
                <div>
                  <SheetTitle className="text-2xl font-black tracking-tight text-foreground">Audit Trail</SheetTitle>
                  <SheetDescription className="font-bold text-[10px] uppercase tracking-widest text-muted-foreground opacity-60">
                    Chronological sequence of approval actions
                  </SheetDescription>
                </div>
              </div>
            </SheetHeader>
          </div>

          <div className="p-8">
            {isLogsLoading ? (
              <div className="flex flex-col items-center justify-center h-64 space-y-4 opacity-40">
                <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                <p className="text-xs font-black uppercase tracking-widest">Fetching logs...</p>
              </div>
            ) : (
              <TAHistoryTimeline 
                logs={logs} 
                currentLevel={selectedRequest?.item.current_approval_level || 1}
                totalLevels={selectedRequest?.item.total_levels || 3}
              />
            )}
            
            {!isLogsLoading && logs.length === 0 && (
               <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed border-muted-foreground/10 rounded-3xl opacity-40">
                 <Clock className="h-10 w-10 mb-3" />
                 <p className="text-xs font-black uppercase tracking-widest">No history recorded yet</p>
                 <p className="text-[10px] mt-1 italic text-center leading-relaxed">
                   Detailed logs will appear here once the first approval action is taken for this request.
                 </p>
               </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
