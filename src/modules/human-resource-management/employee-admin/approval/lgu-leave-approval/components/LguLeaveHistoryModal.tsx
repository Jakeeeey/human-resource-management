"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { History, CheckCircle2, XCircle, ArrowUpRight, Award, User } from "lucide-react";
import { fetchLguLeaveHistory } from "../providers/lguLeaveApprovalProvider";
import { ApprovalHistoryEntry, LguLeaveRequest } from "../types";

interface LguLeaveHistoryModalProps {
  request: LguLeaveRequest | null;
  isOpen: boolean;
  onClose: () => void;
}

export function LguLeaveHistoryModal({
  request,
  isOpen,
  onClose,
}: LguLeaveHistoryModalProps) {
  const [history, setHistory] = useState<ApprovalHistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;
    if (request && isOpen) {
      const loadHistory = async () => {
        try {
          const res = await fetchLguLeaveHistory(request.id);
          if (isMounted) setHistory(res);
        } catch {
          if (isMounted) setHistory([]);
        } finally {
          if (isMounted) setLoading(false);
        }
      };
      loadHistory();
    }
    return () => {
      isMounted = false;
    };
  }, [request, isOpen]);

  if (!request) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-primary/10 rounded-lg text-primary">
              <History className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg">Approval Audit History</DialogTitle>
              <DialogDescription className="text-xs">
                CSC Form No. 6 Application #{request.id} • {request.first_name} {request.last_name} ({request.office_department})
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="py-2">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2">
              <Spinner className="h-6 w-6 text-primary" />
              <p className="text-xs text-muted-foreground">Loading audit logs...</p>
            </div>
          ) : history.length === 0 ? (
            <div className="py-8 text-center border rounded-lg bg-muted/20">
              <p className="text-xs text-muted-foreground">No lifecycle approval logs recorded yet.</p>
              <p className="text-[11px] text-muted-foreground mt-1">Application is at initial stage.</p>
            </div>
          ) : (
            <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-muted-foreground/20">
              {history.map((log, idx) => (
                <div key={log.id || idx} className="relative group">
                  {/* Timeline Node */}
                  <div className="absolute -left-6 top-0.5 flex items-center justify-center w-4 h-4 rounded-full bg-background border-2 border-primary">
                    {log.action_type === "approve" ? (
                      <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                    ) : log.action_type === "disapprove" ? (
                      <XCircle className="h-3 w-3 text-rose-500" />
                    ) : log.action_type === "certify" ? (
                      <Award className="h-3 w-3 text-blue-500" />
                    ) : (
                      <ArrowUpRight className="h-3 w-3 text-primary" />
                    )}
                  </div>

                  <div className="bg-card border rounded-lg p-3 text-xs space-y-1.5 shadow-sm">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 font-semibold text-foreground">
                        <User className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>{log.approver_name}</span>
                        {log.approver_position && (
                          <span className="text-muted-foreground font-normal">({log.approver_position})</span>
                        )}
                      </div>
                      <Badge variant="outline" className="text-[10px] uppercase font-bold">
                        Level {log.level} • {log.action_type}
                      </Badge>
                    </div>

                    {log.remarks && (
                      <p className="text-muted-foreground bg-muted/40 p-2 rounded text-[11px] italic">
                        &ldquo;{log.remarks}&rdquo;
                      </p>
                    )}

                    <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1">
                      <span>Result Status: <strong className="uppercase">{log.status_after}</strong></span>
                      <span>{new Date(log.created_at).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
