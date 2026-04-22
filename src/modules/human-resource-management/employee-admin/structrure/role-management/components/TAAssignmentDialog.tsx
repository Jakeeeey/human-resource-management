"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogFooter,
  DialogDescription
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { SystemUser, TAApprover, Department } from "../types";
import { SearchableSelect } from "./SearchableSelect";
import { UserCheck, Info, Loader2, Layers, Building2 } from "lucide-react";
import { toast } from "sonner";
interface TAAssignmentDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  users: SystemUser[];
  departments: Department[];
  existingAssignments: TAApprover[];
  onConfirm: (data: Partial<TAApprover>) => Promise<void>;
}

export function TAAssignmentDialog({
  isOpen,
  onOpenChange,
  title,
  users,
  departments,
  existingAssignments,
  onConfirm
}: TAAssignmentDialogProps) {
  const [selectedDepartment, setSelectedDepartment] = useState<string>("");
  const [selectedApprover, setSelectedApprover] = useState<string>("");
  const [selectedLevel, setSelectedLevel] = useState<string>("1");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Auto-increment level when department changes
  React.useEffect(() => {
    if (selectedDepartment) {
      const deptId = Number(selectedDepartment);
      const deptAssignments = (existingAssignments || []).filter(a => {
        const dId = typeof a.department_id === 'object' ? a.department_id.department_id : a.department_id;
        return Number(dId) === deptId;
      });
      
      // Auto-increment Level logic
      if (deptAssignments.length > 0) {
        const maxLevel = Math.max(...deptAssignments.map(a => a.level || 0));
        setSelectedLevel((maxLevel + 1).toString());
      } else {
        setSelectedLevel("1");
      }

      // Conflict Check: If an approver was already selected, check if they are a duplicate for this new department
      if (selectedApprover) {
        const isDuplicate = deptAssignments.some(a => {
          const uId = typeof a.approver_id === 'object' ? a.approver_id.user_id : a.approver_id;
          return Number(uId) === Number(selectedApprover);
        });

        if (isDuplicate) {
          toast.error("Duplicate Assignment", {
            description: "This approver is already assigned to the selected department."
          });
          setSelectedApprover("");
        }
      }
    }
  }, [selectedDepartment, existingAssignments, selectedApprover]);

  const handleConfirm = async () => {
    if (!selectedDepartment || !selectedApprover) return;

    // Check if approver is already assigned to this department at ANY level (Safeguard)
    const isDuplicate = (existingAssignments || []).some(a => {
      const dId = typeof a.department_id === 'object' ? a.department_id.department_id : a.department_id;
      const uId = typeof a.approver_id === 'object' ? a.approver_id.user_id : a.approver_id;
      return Number(dId) === Number(selectedDepartment) && Number(uId) === Number(selectedApprover);
    });

    if (isDuplicate) return;

    setIsSubmitting(true);
    try {
        await onConfirm({
          department_id: Number(selectedDepartment),
          approver_id: Number(selectedApprover),
          level: Number(selectedLevel)
        });
        toast.success("Assignment Saved", {
          description: "New approval mapping has been created successfully."
        });
        onOpenChange(false);
      setSelectedDepartment("");
      setSelectedApprover("");
      setSelectedLevel("1");
    } catch (error) {
      console.error("Failed to save TA assignment:", error);
      toast.error("Save Failed", {
        description: "Failed to create the approval mapping. Please try again."
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const safeDepartments = Array.isArray(departments) ? departments : [];

  const departmentOptions = safeDepartments.map(d => ({
    value: d.department_id.toString(),
    label: d.department_name
  }));

  const userOptions = React.useMemo(() => {
    const safeUsers = Array.isArray(users) ? users : [];
    let filteredUsers = safeUsers;

    // If a department is selected, filter out users already assigned to it
    if (selectedDepartment) {
      const deptId = Number(selectedDepartment);
      const alreadyAssignedUserIds = (existingAssignments || [])
        .filter(a => {
          const dId = typeof a.department_id === 'object' ? a.department_id.department_id : a.department_id;
          return Number(dId) === deptId;
        })
        .map(a => typeof a.approver_id === 'object' ? a.approver_id.user_id : a.approver_id);

      filteredUsers = safeUsers.filter(u => !alreadyAssignedUserIds.includes(u.user_id));
    }

    return filteredUsers.map(u => ({
      value: u.user_id.toString(),
      label: `${u.user_fname} ${u.user_lname} (${u.user_position})`
    }));
  }, [users, selectedDepartment, existingAssignments]);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px] p-0 border-none shadow-2xl rounded-2xl overflow-visible">
        <div className="p-6 pb-4 flex items-center gap-4 bg-violet-50/50">
          <div className="p-2.5 rounded-xl bg-white shadow-sm ring-1 ring-black/5 text-violet-500">
            <UserCheck className="h-6 w-6" />
          </div>
          <div>
            <DialogTitle className="text-xl font-bold tracking-tight text-foreground/90">{title}</DialogTitle>
            <DialogDescription className="text-xs uppercase font-extrabold tracking-widest text-muted-foreground/60 mt-0.5">
              Draft Approval Mapping
            </DialogDescription>
          </div>
        </div>

        <div className="p-6 pt-2 space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-[13px] font-bold text-foreground/70 ml-1 flex items-center gap-2">
                <UserCheck className="h-3.5 w-3.5 opacity-40" />
                Approver (Authority)
              </Label>
              <SearchableSelect
                options={userOptions}
                value={selectedApprover}
                onValueChange={setSelectedApprover}
                placeholder="Select authorized person"
                className="h-12 border-muted-foreground/10 bg-muted/5 font-medium"
              />
              <p className="text-[11px] text-muted-foreground ml-1">The person authorized to approve the drafts.</p>
            </div>

            <div className="space-y-2">
              <Label className="text-[13px] font-bold text-foreground/70 ml-1 flex items-center gap-2">
                <Building2 className="h-3.5 w-3.5 opacity-40" />
                Target Department
              </Label>
              <SearchableSelect
                options={departmentOptions}
                value={selectedDepartment}
                onValueChange={setSelectedDepartment}
                placeholder="Select department"
                className="h-12 border-muted-foreground/10 bg-muted/5 font-medium"
              />
              <p className="text-[11px] text-muted-foreground ml-1">The department whose requests will be approved by this person.</p>
            </div>

            <div className="space-y-2">
              <Label className="text-[13px] font-bold text-foreground/70 ml-1 flex items-center gap-2">
                <Layers className="h-3.5 w-3.5 opacity-40" />
                Approval Level
              </Label>
              <Input 
                type="number" 
                min={1} 
                value={selectedLevel} 
                onChange={e => setSelectedLevel(e.target.value)} 
                className="h-12 border-muted-foreground/10 bg-muted/5 font-bold"
              />
              <p className="text-[11px] text-muted-foreground ml-1">Order of approval (1 = First state, 2 = Second, etc).</p>
            </div>
          </div>

          <div className="bg-primary/5 p-3 rounded-lg border border-primary/10 flex gap-3">
            <Info className="h-5 w-5 text-primary shrink-0 mt-0.5 opacity-70" />
            <p className="text-[11px] leading-relaxed text-primary/80 font-medium">
              This mapping determines the workflow for Time & Attendance draft submissions. Ensure the level sequence is correct for the organizational unit.
            </p>
          </div>
        </div>

        <DialogFooter className="p-6 bg-muted/30 border-t border-muted-foreground/5 gap-3 sm:gap-0">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="text-muted-foreground hover:bg-transparent font-bold text-xs uppercase tracking-widest"
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isSubmitting || !selectedDepartment || !selectedApprover}
            className="rounded-full px-8 bg-foreground text-background hover:bg-foreground/90 shadow-xl transition-all active:scale-95 font-bold disabled:opacity-50"
          >
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Mapping"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
