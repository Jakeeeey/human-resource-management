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
import { SystemUser, Division, Salesman, SupervisorPerDivision, ExpenseReviewCommittee } from "../types";
import { SearchableSelect } from "./SearchableSelect";
import { Shield, Users, UserPlus, Settings, LayoutDashboard, Briefcase, Info, Loader2, CircleDollarSign, Layers } from "lucide-react";
import { cn } from "@/lib/utils";

interface RoleAssignmentDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  type: "executive" | "division-head" | "supervisor" | "salesman" | "review-committee" | "expense-review-committee";
  users: SystemUser[];
  divisions?: Division[];
  salesmen?: Salesman[];
  supervisors?: SupervisorPerDivision[];
  expenseReviewers?: ExpenseReviewCommittee[];
  onConfirm: (...args: number[]) => Promise<void>;
}

const getUser = (val: number | SystemUser | undefined) => typeof val === 'object' ? val : null;
const getDivision = (val: number | Division | undefined) => typeof val === 'object' ? val : null;

const typeConfig = {
  executive: { icon: Shield, color: "text-blue-500", bg: "bg-blue-50/50" },
  "division-head": { icon: LayoutDashboard, color: "text-indigo-500", bg: "bg-indigo-50/50" },
  supervisor: { icon: Users, color: "text-emerald-500", bg: "bg-emerald-50/50" },
  salesman: { icon: UserPlus, color: "text-orange-500", bg: "bg-orange-50/50" },
  "review-committee": { icon: Settings, color: "text-violet-500", bg: "bg-violet-50/50" },
  "expense-review-committee": { icon: CircleDollarSign, color: "text-rose-500", bg: "bg-rose-50/50" }
};

export function RoleAssignmentDialog({
  isOpen,
  onOpenChange,
  title,
  type,
  users,
  divisions = [],
  salesmen = [],
  supervisors = [],
  expenseReviewers = [],
  onConfirm
}: RoleAssignmentDialogProps) {
  const [selectedUser, setSelectedUser] = useState<string>("");
  const [selectedDivision, setSelectedDivision] = useState<string>("");
  const [selectedSalesman, setSelectedSalesman] = useState<string>("");
  const [selectedSupervisorAsmt, setSelectedSupervisorAsmt] = useState<string>("");
  const [selectedHierarchy, setSelectedHierarchy] = useState<string>("1");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const config = typeConfig[type];
  const Icon = config.icon;

  // Sequential Hierarchy Logic
  const existingLevels = React.useMemo(() => {
    if (selectedDivision && type === "expense-review-committee") {
      return expenseReviewers
        .filter(r => {
          const divId = typeof r.division_id === 'object' ? r.division_id.division_id : r.division_id;
          return divId.toString() === selectedDivision;
        })
        .map(r => r.approver_heirarchy)
        .filter(Boolean)
        .sort((a, b) => a - b);
    }
    return [];
  }, [selectedDivision, type, expenseReviewers]);

  const nextRequiredLevel = React.useMemo(() => {
    let level = 1;
    while (existingLevels.includes(level)) {
      level++;
    }
    return level;
  }, [existingLevels]);

  // Auto-set hierarchy when division changes
  React.useEffect(() => {
    if (type === "expense-review-committee" && selectedDivision) {
      setSelectedHierarchy(nextRequiredLevel.toString());
    }
  }, [selectedDivision, type, nextRequiredLevel]);

  const handleConfirm = async () => {
    if (!selectedUser && type !== "salesman") return;
    if ((type === "division-head" || type === "expense-review-committee") && !selectedDivision) return;
    if (type === "supervisor" && !selectedDivision) return;
    if (type === "salesman" && (!selectedSupervisorAsmt || !selectedSalesman)) return;

    setIsSubmitting(true);
    try {
      if (type === "executive" || type === "review-committee") {
        await onConfirm(Number(selectedUser));
      } else if (type === "division-head" || type === "supervisor") {
        await onConfirm(Number(selectedDivision), Number(selectedUser));
      } else if (type === "expense-review-committee") {
        await onConfirm(Number(selectedDivision), Number(selectedUser), Number(selectedHierarchy));
      } else if (type === "salesman") {
        await onConfirm(Number(selectedSupervisorAsmt), Number(selectedSalesman));
      }
      onOpenChange(false);
      setSelectedUser("");
      setSelectedDivision("");
      setSelectedSalesman("");
      setSelectedSupervisorAsmt("");
      setSelectedHierarchy("1");
    } catch (error) {
      console.error("Failed to save assignment:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const userOptions = users.map(u => ({
    value: u.user_id.toString(),
    label: `${u.user_fname} ${u.user_lname} (${u.user_position})`
  }));

  const divisionOptions = divisions.map(d => ({
    value: d.division_id.toString(),
    label: d.division_name
  }));

  const supervisorAsmtOptions = supervisors.map(s => ({
    value: s.id.toString(),
    label: `${getUser(s.supervisor_id)?.user_fname} ${getUser(s.supervisor_id)?.user_lname} (${getDivision(s.division_id)?.division_name})`
  }));

  const salesmanOptions = salesmen.map(s => ({
    value: s.id.toString(),
    label: `${s.salesman_name} (${s.salesman_code})`
  }));

  const isHierarchyInvalid = type === "expense-review-committee" && Number(selectedHierarchy) !== nextRequiredLevel;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px] p-0 border-none shadow-2xl rounded-2xl overflow-visible">
        <div className={cn("p-6 pb-4 flex items-center gap-4", config.bg)}>
          <div className={cn("p-2.5 rounded-xl bg-white shadow-sm ring-1 ring-black/5", config.color)}>
            <Icon className="h-6 w-6" />
          </div>
          <div>
            <DialogTitle className="text-xl font-bold tracking-tight text-foreground/90">{title}</DialogTitle>
            <DialogDescription className="text-xs uppercase font-extrabold tracking-widest text-muted-foreground/60 mt-0.5">
              Configuration Panel
            </DialogDescription>
          </div>
        </div>

        <div className="p-6 pt-2 space-y-6">
          <div className="space-y-4">
            {(type === "division-head" || type === "supervisor" || type === "expense-review-committee") && (
              <div className="space-y-2">
                <Label className="text-[13px] font-bold text-foreground/70 ml-1 flex items-center gap-2">
                  <LayoutDashboard className="h-3.5 w-3.5 opacity-40" />
                  Business Unit
                </Label>
                <SearchableSelect
                  options={divisionOptions}
                  value={selectedDivision}
                  onValueChange={setSelectedDivision}
                  placeholder="Select a business unit"
                  className="h-12 border-muted-foreground/10 bg-muted/5 font-medium"
                />
                <p className="text-[11px] text-muted-foreground ml-1">Assign this role to a specific vertical.</p>
              </div>
            )}

            {type === "expense-review-committee" && (
              <div className="space-y-2">
                <Label className="text-[13px] font-bold text-foreground/70 ml-1 flex items-center gap-2">
                  <Layers className="h-3.5 w-3.5 opacity-40" />
                  Approval Hierarchy Level
                </Label>
                <div className="flex flex-col gap-1.5">
                  <Input 
                    type="number" 
                    min={1} 
                    value={selectedHierarchy} 
                    onChange={e => setSelectedHierarchy(e.target.value)} 
                    placeholder="E.g. 1" 
                    className="h-12 border-muted-foreground/10 bg-muted/5 font-bold"
                  />
                  {selectedDivision ? (
                    <p className="text-[11px] text-muted-foreground ml-1">
                      {existingLevels.length > 0 
                        ? <>Levels assigned: <strong className="text-foreground/80">{Array.from(new Set(existingLevels)).join(', ')}</strong>. Next required: <strong className="text-primary">{nextRequiredLevel}</strong></>
                        : <>No levels assigned yet. Next required: <strong className="text-primary">1</strong></>}
                      <br/>
                      <strong className="text-foreground/70">Note: Levels must be assigned sequentially (1, 2, 3...) with no gaps.</strong>
                    </p>
                  ) : (
                    <p className="text-[11px] text-muted-foreground ml-1">
                      Select a business unit first to calculate the next sequence.<br/>
                      <strong className="text-foreground/70">Note: As the level goes up, the approval authority is higher.</strong>
                    </p>
                  )}
                  {isHierarchyInvalid && selectedDivision && (
                    <p className="text-[11px] font-bold text-destructive ml-1 animate-in fade-in slide-in-from-top-1">
                      Invalid Level. You must assign Level {nextRequiredLevel} before moving to higher levels.
                    </p>
                  )}
                </div>
              </div>
            )}

            {type === "salesman" && (
              <div className="space-y-2">
                <Label className="text-[13px] font-bold text-foreground/70 ml-1 flex items-center gap-2">
                  <Users className="h-3.5 w-3.5 opacity-40" />
                  Supervisor Authority
                </Label>
                <SearchableSelect
                  options={supervisorAsmtOptions}
                  value={selectedSupervisorAsmt}
                  onValueChange={setSelectedSupervisorAsmt}
                  placeholder="Select supervisor"
                  className="h-12 border-muted-foreground/10 bg-muted/5 font-medium"
                />
                <p className="text-[11px] text-muted-foreground ml-1">Determines the reporting hierarchy.</p>
              </div>
            )}

            {(type === "executive" || type === "division-head" || type === "supervisor" || type === "review-committee" || type === "expense-review-committee") && (
              <div className="space-y-2">
                <Label className="text-[13px] font-bold text-foreground/70 ml-1 flex items-center gap-2">
                  <Briefcase className="h-3.5 w-3.5 opacity-40" />
                  Personnel Selection
                </Label>
                <SearchableSelect
                  options={userOptions}
                  value={selectedUser}
                  onValueChange={setSelectedUser}
                  placeholder="Choose an employee"
                  className="h-12 border-muted-foreground/10 bg-muted/5 font-medium"
                />
                <p className="text-[11px] text-muted-foreground ml-1">Only eligible employees are listed here.</p>
              </div>
            )}

            {type === "salesman" && (
              <div className="space-y-2">
                <Label className="text-[13px] font-bold text-foreground/70 ml-1 flex items-center gap-2">
                  <UserPlus className="h-3.5 w-3.5 opacity-40" />
                  Sales Associate
                </Label>
                <SearchableSelect
                  options={salesmanOptions}
                  value={selectedSalesman}
                  onValueChange={setSelectedSalesman}
                  placeholder="Link a salesman"
                  className="h-12 border-muted-foreground/10 bg-muted/5 font-medium"
                />
                <p className="text-[11px] text-muted-foreground ml-1">The actual identity being registered.</p>
              </div>
            )}
          </div>

          <div className="bg-primary/5 p-3 rounded-lg border border-primary/10 flex gap-3">
            <Info className="h-5 w-5 text-primary shrink-0 mt-0.5 opacity-70" />
            <p className="text-[11px] leading-relaxed text-primary/80 font-medium">
              This action will take effect immediately across all linked modules and reporting dashboards. Ensure all details are verified.
            </p>
          </div>
        </div>

        <DialogFooter className="p-6 bg-muted/30 border-t border-muted-foreground/5 gap-3 sm:gap-0">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="text-muted-foreground hover:bg-transparent font-bold text-xs uppercase tracking-widest"
          >
            Collapse
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isSubmitting || isHierarchyInvalid}
            className="rounded-full px-8 bg-foreground text-background hover:bg-foreground/90 shadow-xl transition-all active:scale-95 font-bold disabled:opacity-50 disabled:pointer-events-none"
          >
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Finalize Assignment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

