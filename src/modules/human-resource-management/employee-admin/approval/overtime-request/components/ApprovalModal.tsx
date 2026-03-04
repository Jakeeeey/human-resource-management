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

interface ApprovalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (remarks: string) => void;
  action: "approve" | "reject" | null;
  employeeName: string;
  isLoading?: boolean;
}

export function ApprovalModal({
  isOpen,
  onClose,
  onConfirm,
  action,
  employeeName,
  isLoading = false,
}: ApprovalModalProps) {
  const [remarks, setRemarks] = useState("");

  const handleConfirm = () => {
    onConfirm(remarks);
    setRemarks("");
  };

  const handleClose = () => {
    setRemarks("");
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-125">
        <DialogHeader>
          <DialogTitle>
            {action === "approve" ? "Approve" : "Reject"} Overtime Request
          </DialogTitle>
          <DialogDescription>
            {action === "approve" 
              ? `You are about to approve the overtime request for ${employeeName}.`
              : `You are about to reject the overtime request for ${employeeName}.`
            }
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="remarks">
              Remarks {" "}
              <span className="text-muted-foreground text-sm">(Optional)</span>
            </Label>
            <Textarea
              id="remarks"
              placeholder="Enter your remarks here..."
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              rows={4}
              disabled={isLoading}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={isLoading}
            variant={action === "approve" ? "default" : "destructive"}
          >
            {isLoading ? "Processing..." : action === "approve" ? "Approve" : "Reject"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
