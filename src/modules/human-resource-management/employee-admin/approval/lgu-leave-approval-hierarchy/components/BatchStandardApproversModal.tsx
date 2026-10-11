"use client";

import { useState } from "react";
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
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ShieldCheck,
  Crown,
  Layers,
  Sparkles,
} from "lucide-react";
import {
  DepartmentInfo,
  UserInfo,
  BatchApplyStandardApproversInput,
} from "../types";

interface BatchStandardApproversModalProps {
  isOpen: boolean;
  onClose: () => void;
  departments: DepartmentInfo[];
  users: UserInfo[];
  onSubmit: (data: BatchApplyStandardApproversInput) => Promise<boolean>;
}

export function BatchStandardApproversModal({
  isOpen,
  onClose,
  departments,
  users,
  onSubmit,
}: BatchStandardApproversModalProps) {
  const [selectedDeptIds, setSelectedDeptIds] = useState<number[]>(
    departments.map((d) => d.department_id)
  );
  const [level2Id, setLevel2Id] = useState<string>("");
  const [level3Id, setLevel3Id] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleSelectAll = () => {
    if (selectedDeptIds.length === departments.length) {
      setSelectedDeptIds([]);
    } else {
      setSelectedDeptIds(departments.map((d) => d.department_id));
    }
  };

  const toggleDept = (deptId: number) => {
    if (selectedDeptIds.includes(deptId)) {
      setSelectedDeptIds(selectedDeptIds.filter((id) => id !== deptId));
    } else {
      setSelectedDeptIds([...selectedDeptIds, deptId]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedDeptIds.length === 0) {
      setError("Please select at least one department.");
      return;
    }
    if (!level2Id && !level3Id) {
      setError("Please select at least Level 2 (HRMO) or Level 3 (Mayor).");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const success = await onSubmit({
        target_department_ids: selectedDeptIds,
        level2_approver_id: level2Id ? Number(level2Id) : null,
        level3_approver_id: level3Id ? Number(level3Id) : null,
      });
      if (success) {
        onClose();
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[95vw] sm:max-w-xl max-h-[92vh] overflow-y-auto p-0">
        <DialogHeader className="p-6 pb-3 bg-gradient-to-r from-slate-900 to-slate-800 text-white rounded-t-lg">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-primary/20 rounded-xl text-primary-foreground backdrop-blur-sm">
              <Sparkles className="h-5 w-5 text-amber-400" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold">
                Batch Apply Standard HRMO & Mayor Approvers
              </DialogTitle>
              <DialogDescription className="text-slate-300 text-xs">
                In Philippine LGUs, Level 2 (HRMO) and Level 3 (Mayor) are uniform across departments.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 rounded-lg text-xs font-medium">
              {error}
            </div>
          )}

          {/* Level 2 Picker */}
          <div className="space-y-1.5 p-3.5 bg-purple-500/5 border border-purple-500/20 rounded-xl">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-purple-500" />
              <Label className="text-xs font-bold text-foreground">
                Level 2: Standard HRMO Officer (Section 7.A)
              </Label>
            </div>
            <select
              value={level2Id}
              onChange={(e) => setLevel2Id(e.target.value)}
              className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-xs focus:outline-hidden focus:ring-1 focus:ring-ring"
            >
              <option value="">-- Leave Unchanged / Do Not Override --</option>
              {users.map((u) => (
                <option key={u.user_id} value={u.user_id}>
                  {u.user_fname} {u.user_lname} ({u.user_position})
                </option>
              ))}
            </select>
          </div>

          {/* Level 3 Picker */}
          <div className="space-y-1.5 p-3.5 bg-emerald-500/5 border border-emerald-500/20 rounded-xl">
            <div className="flex items-center gap-2">
              <Crown className="h-4 w-4 text-emerald-500" />
              <Label className="text-xs font-bold text-foreground">
                Level 3: Municipal Mayor / Head of Agency (Section 7.C)
              </Label>
            </div>
            <select
              value={level3Id}
              onChange={(e) => setLevel3Id(e.target.value)}
              className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-xs focus:outline-hidden focus:ring-1 focus:ring-ring"
            >
              <option value="">-- Leave Unchanged / Do Not Override --</option>
              {users.map((u) => (
                <option key={u.user_id} value={u.user_id}>
                  {u.user_fname} {u.user_lname} ({u.user_position})
                </option>
              ))}
            </select>
          </div>

          {/* Target Departments Multi-Select */}
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold text-foreground">
                Select Target Departments ({selectedDeptIds.length} of {departments.length} Selected)
              </Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={toggleSelectAll}
                className="h-6 text-xs text-primary font-semibold"
              >
                {selectedDeptIds.length === departments.length
                  ? "Deselect All"
                  : "Select All"}
              </Button>
            </div>

            <div className="border rounded-lg max-h-44 overflow-y-auto divide-y bg-background p-1">
              {departments.map((d) => {
                const isChecked = selectedDeptIds.includes(d.department_id);
                return (
                  <div
                    key={d.department_id}
                    onClick={() => toggleDept(d.department_id)}
                    className="p-2 text-xs flex items-center justify-between hover:bg-muted/40 cursor-pointer rounded"
                  >
                    <span className="font-medium text-foreground">
                      {d.department_name}
                    </span>
                    <Checkbox
                      checked={isChecked}
                      onCheckedChange={() => toggleDept(d.department_id)}
                    />
                  </div>
                );
              })}
            </div>
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
              className="text-xs font-semibold gap-1.5"
            >
              {submitting ? "Applying..." : "Apply to Selected Departments"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
