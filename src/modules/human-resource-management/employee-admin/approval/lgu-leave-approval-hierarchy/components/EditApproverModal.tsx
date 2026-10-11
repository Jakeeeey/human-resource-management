"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Pencil, UserCheck, ShieldCheck, Crown } from "lucide-react";
import {
  LguLeaveApprover,
  DepartmentInfo,
  UpdateApproverInput,
  LGU_HIERARCHY_LEVELS,
} from "../types";

interface EditApproverModalProps {
  isOpen: boolean;
  onClose: () => void;
  approver: LguLeaveApprover | null;
  departments: DepartmentInfo[];
  onSubmit: (data: UpdateApproverInput) => Promise<boolean>;
}

export function EditApproverModal({
  isOpen,
  onClose,
  approver,
  departments,
  onSubmit,
}: EditApproverModalProps) {
  const [departmentId, setDepartmentId] = useState<string>("");
  const [level, setLevel] = useState<string>("1");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (approver && isOpen) {
      setDepartmentId(String(approver.department_id));
      setLevel(String(approver.level));
    }
  }, [approver, isOpen]);

  if (!approver) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const success = await onSubmit({
        id: approver.id,
        department_id: Number(departmentId),
        level: Number(level),
      });
      if (success) {
        onClose();
      }
    } finally {
      setSubmitting(false);
    }
  };

  const selectedLevelConfig = LGU_HIERARCHY_LEVELS.find(
    (l) => l.level === Number(level)
  );

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[95vw] sm:max-w-lg max-h-[92vh] overflow-y-auto p-0">
        <DialogHeader className="p-6 pb-3 bg-gradient-to-r from-slate-900 to-slate-800 text-white rounded-t-lg">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-primary/20 rounded-xl text-primary-foreground">
              <Pencil className="h-5 w-5 text-indigo-400" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold">
                Edit Approver Hierarchy
              </DialogTitle>
              <DialogDescription className="text-slate-300 text-xs">
                Update approval level or department assignment for {approver.approver_name}.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Officer Preview Card */}
          <div className="p-3.5 bg-muted/40 rounded-xl border">
            <p className="text-xs font-bold text-foreground">
              {approver.approver_name}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {approver.approver_position} • {approver.approver_email}
            </p>
          </div>

          {/* Department Selection */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-foreground">
              Assigned Department
            </Label>
            <Select
              value={departmentId}
              onValueChange={setDepartmentId}
            >
              <SelectTrigger className="text-xs h-9">
                <SelectValue placeholder="Select Department" />
              </SelectTrigger>
              <SelectContent>
                {departments.map((d) => (
                  <SelectItem
                    key={d.department_id}
                    value={String(d.department_id)}
                    className="text-xs"
                  >
                    {d.department_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Level Selection */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-foreground">
              Approval Hierarchy Level
            </Label>
            <Select value={level} onValueChange={setLevel}>
              <SelectTrigger className="text-xs h-9">
                <SelectValue placeholder="Select Level" />
              </SelectTrigger>
              <SelectContent>
                {LGU_HIERARCHY_LEVELS.map((lvl) => (
                  <SelectItem
                    key={lvl.level}
                    value={String(lvl.level)}
                    className="text-xs"
                  >
                    {lvl.title} — {lvl.section}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Level Role Explainer Card */}
            {selectedLevelConfig && (
              <div className="p-3 bg-muted/40 rounded-lg border text-xs space-y-1 mt-2">
                <div className="flex items-center gap-1.5 font-bold text-foreground">
                  {selectedLevelConfig.level === 1 && (
                    <UserCheck className="h-4 w-4 text-indigo-500" />
                  )}
                  {selectedLevelConfig.level === 2 && (
                    <ShieldCheck className="h-4 w-4 text-purple-500" />
                  )}
                  {selectedLevelConfig.level === 3 && (
                    <Crown className="h-4 w-4 text-emerald-500" />
                  )}
                  <span>{selectedLevelConfig.subtitle}</span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  {selectedLevelConfig.description}
                </p>
              </div>
            )}
          </div>

          <DialogFooter className="pt-4 border-t gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={submitting}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={submitting}
              className="text-xs font-semibold"
            >
              {submitting ? "Updating..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
