"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { AttendanceLogWithUser } from "../type";

interface ApprovalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (remarks: string) => Promise<void>;
  title: string;
  description: string;
  confirmText: string;
  confirmVariant?: "default" | "destructive";
  log?: AttendanceLogWithUser | null;
}

export function ApprovalModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText,
  confirmVariant = "default",
  log
}: ApprovalModalProps) {
  const [remarks, setRemarks] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleConfirm = async () => {
    try {
      setIsSubmitting(true);
      await onConfirm(remarks);
      setRemarks("");
      onClose();
    } catch (error) {
      console.error("Action failed:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px] p-0 overflow-hidden border-none shadow-2xl bg-background/95 backdrop-blur-xl rounded-2xl">
        <DialogHeader className="p-8 pb-0">
          <DialogTitle className="text-2xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/60 bg-clip-text text-transparent">
            {title}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground font-medium pt-2">
            {description}
          </DialogDescription>
        </DialogHeader>

        {log && (
          <div className="px-8 mt-4">
            <div className="flex gap-2 p-3 bg-muted/40 rounded-2xl border border-border/50 shadow-inner">
               <div className="flex-1 text-center">
                  <div className="text-[10px] uppercase font-bold text-muted-foreground">Work</div>
                  <div className="text-sm font-bold text-foreground">{log.work_minutes}m</div>
               </div>
               <div className="w-[1px] h-8 bg-border/50 self-center" />
               <div className="flex-1 text-center">
                  <div className="text-[10px] uppercase font-bold text-muted-foreground">Late</div>
                  <div className="text-sm font-bold text-red-500">{log.late_minutes}m</div>
               </div>
               <div className="w-[1px] h-8 bg-border/50 self-center" />
               <div className="flex-1 text-center">
                  <div className="text-[10px] uppercase font-bold text-muted-foreground">UT</div>
                  <div className="text-sm font-bold text-orange-500">{log.undertime_minutes}m</div>
               </div>
               <div className="w-[1px] h-8 bg-border/50 self-center" />
               <div className="flex-1 text-center">
                  <div className="text-[10px] uppercase font-bold text-muted-foreground">OT</div>
                  <div className="text-sm font-bold text-green-500">{log.overtime_minutes}m</div>
               </div>
            </div>
          </div>
        )}
        <div className="grid gap-4 p-8 pt-6">
          <div className="grid gap-3">
            <Label htmlFor="remarks" className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">
              Remarks <span className="text-[10px] lowercase font-normal opacity-60">(Optional)</span>
            </Label>
            <Textarea
              id="remarks"
              placeholder="Enter your justification or notes here..."
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              className="resize-none rounded-2xl border-muted-foreground/20 focus-visible:ring-primary/20 bg-muted/30 min-h-[100px]"
              rows={3}
              disabled={isSubmitting}
            />
          </div>
        </div>
        <DialogFooter className="bg-muted/30 p-6 flex-row gap-2 border-t border-border/50">
          <Button 
            variant="ghost" 
            onClick={onClose} 
            disabled={isSubmitting}
            className="flex-1 rounded-xl h-11 font-bold hover:bg-background/80"
          >
            Cancel
          </Button>
          <Button
            variant={confirmVariant}
            onClick={handleConfirm}
            disabled={isSubmitting}
            className={cn(
              "flex-1 rounded-xl h-11 font-bold shadow-lg shadow-primary/10 transition-all active:scale-95",
              confirmVariant === "destructive" ? "bg-red-500 hover:bg-red-600" : "bg-primary hover:bg-primary/90"
            )}
          >
            {isSubmitting ? (
              <div className="flex items-center gap-2">
                 <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                 Processing
              </div>
            ) : confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
