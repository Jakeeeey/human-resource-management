"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Trash2 } from "lucide-react";
import { LguLeaveApprover } from "../types";

interface DeleteApproverDialogProps {
  isOpen: boolean;
  onClose: () => void;
  approver: LguLeaveApprover | null;
  onConfirm: (id: number) => Promise<boolean>;
}

export function DeleteApproverDialog({
  isOpen,
  onClose,
  approver,
  onConfirm,
}: DeleteApproverDialogProps) {
  if (!approver) return null;

  const handleConfirm = async () => {
    await onConfirm(approver.id);
    onClose();
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent className="w-[95vw] sm:max-w-md">
        <AlertDialogHeader>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-rose-500/10 text-rose-600 rounded-lg shrink-0">
              <Trash2 className="h-5 w-5" />
            </div>
            <AlertDialogTitle className="text-base font-bold text-foreground">
              Remove Approver from Hierarchy
            </AlertDialogTitle>
          </div>
          <AlertDialogDescription className="text-xs text-muted-foreground pt-2 space-y-2">
            Are you sure you want to remove{" "}
            <span className="font-semibold text-foreground">
              {approver.approver_name}
            </span>{" "}
            from{" "}
            <span className="font-semibold text-foreground">
              Level {approver.level} ({approver.department_name})
            </span>
            ?
            <span className="block text-muted-foreground/90 mt-1">
              Leave requests pending at this approval tier will no longer be routed to this officer.
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2">
          <AlertDialogCancel onClick={onClose} className="text-xs">
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            className="text-xs bg-rose-600 hover:bg-rose-700 text-white"
          >
            Confirm Removal
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
