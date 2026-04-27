"use client";

import React from "react";
import { 
  CheckCircle2, 
  Clock, 
  XCircle, 
  RotateCcw, 
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

interface HistoryLog {
  history_id: number;
  status_after: string;
  remarks: string | null;
  created_at: string;
  approver_id: {
    user_fname: string;
    user_lname: string;
    user_position: string;
  };
}

interface TAHistoryTimelineProps {
  logs: HistoryLog[];
  currentLevel: number;
  totalLevels: number;
}

export function TAHistoryTimeline({ logs, currentLevel, totalLevels }: TAHistoryTimelineProps) {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved': return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
      case 'rejected': return <XCircle className="h-4 w-4 text-destructive" />;
      case 'returned': return <RotateCcw className="h-4 w-4 text-amber-500" />;
      default: return <Clock className="h-4 w-4 text-primary" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return "bg-emerald-500/20 ring-emerald-500/30";
      case 'rejected': return "bg-destructive/20 ring-destructive/30";
      case 'returned': return "bg-amber-500/20 ring-amber-500/30";
      default: return "bg-primary/20 ring-primary/30";
    }
  };

  return (
    <div className="space-y-8 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-muted-foreground/20 before:to-transparent">
      {/* Existing Logs */}
      {logs.map((log, idx) => (
        <div key={log.history_id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group animate-in fade-in slide-in-from-left-2 duration-300" style={{ animationDelay: `${idx * 100}ms` }}>
          {/* Dot */}
          <div className={cn(
            "flex items-center justify-center w-10 h-10 rounded-full border border-white shadow-sm shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10 ring-4 transition-all duration-500",
            getStatusColor(log.status_after)
          )}>
            {getStatusIcon(log.status_after)}
          </div>
          
          {/* Content */}
          <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-2xl bg-white/50 border border-muted-foreground/10 shadow-sm backdrop-blur-sm group-hover:bg-white group-hover:shadow-md transition-all">
            <div className="flex items-center justify-between mb-1">
              <div className="font-black text-[11px] uppercase tracking-widest text-foreground/80">
                {log.approver_id?.user_fname} {log.approver_id?.user_lname}
              </div>
              <time className="text-[9px] font-bold text-muted-foreground uppercase">
                {format(new Date(log.created_at), "MMM dd, yyyy • h:mm a")}
              </time>
            </div>
            <div className="text-[10px] font-bold text-primary italic mb-2">
              {log.approver_id?.user_position}
            </div>
            {log.remarks && (
              <div className="p-2.5 rounded-xl bg-muted/30 border border-muted-foreground/5 text-[11px] leading-relaxed italic text-muted-foreground">
                &quot;{log.remarks}&quot;
              </div>
            )}
            <div className="mt-2 flex items-center gap-1.5">
              <div className={cn("px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-tighter", 
                log.status_after === 'approved' ? "bg-emerald-500/10 text-emerald-600" : 
                log.status_after === 'rejected' ? "bg-destructive/10 text-destructive" : 
                "bg-amber-500/10 text-amber-600"
              )}>
                {log.status_after}
              </div>
            </div>
          </div>
        </div>
      ))}

      {/* Upcoming / Current Stepper (Optional visualization) */}
      {currentLevel <= totalLevels && logs.every(l => l.status_after !== 'rejected') && (
        <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group opacity-50 italic">
          <div className="flex items-center justify-center w-10 h-10 rounded-full border-2 border-dashed border-muted-foreground/20 bg-muted/10 shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
            <Clock className="h-4 w-4 text-muted-foreground/40" />
          </div>
          <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-2xl border-2 border-dashed border-muted-foreground/10 bg-muted/5">
             <div className="font-black text-[10px] uppercase tracking-widest text-muted-foreground/60 italic">
                Pending Tier {currentLevel} of {totalLevels}
             </div>
             <p className="text-[10px] mt-1 text-muted-foreground/40">Waiting for next level approver review...</p>
          </div>
        </div>
      )}
    </div>
  );
}
