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
import { Input } from "@/components/ui/input";
import { UserPlus, UserCheck, ShieldCheck, Crown, Search } from "lucide-react";
import {
  DepartmentInfo,
  UserInfo,
  CreateApproverInput,
  LGU_HIERARCHY_LEVELS,
} from "../types";

interface AddApproverModalProps {
  isOpen: boolean;
  onClose: () => void;
  departments: DepartmentInfo[];
  users: UserInfo[];
  defaultDepartmentId?: number;
  defaultLevel?: number;
  onSubmit: (data: CreateApproverInput) => Promise<boolean>;
}

export function AddApproverModal({
  isOpen,
  onClose,
  departments,
  users,
  defaultDepartmentId,
  defaultLevel = 1,
  onSubmit,
}: AddApproverModalProps) {
  const [departmentId, setDepartmentId] = useState<string>("");
  const [approverId, setApproverId] = useState<string>("");
  const [level, setLevel] = useState<string>("1");
  const [userSearch, setUserSearch] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setDepartmentId(
        defaultDepartmentId
          ? String(defaultDepartmentId)
          : departments[0]
          ? String(departments[0].department_id)
          : ""
      );
      setLevel(defaultLevel ? String(defaultLevel) : "1");
      setApproverId("");
      setUserSearch("");
      setError(null);
    }
  }, [isOpen, defaultDepartmentId, defaultLevel, departments]);

  const filteredUsers = users.filter((u) => {
    const q = userSearch.toLowerCase();
    const fullName = `${u.user_fname} ${u.user_lname}`.toLowerCase();
    return (
      fullName.includes(q) ||
      u.user_position.toLowerCase().includes(q) ||
      u.user_email.toLowerCase().includes(q)
    );
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!departmentId) {
      setError("Please select a target department.");
      return;
    }
    if (!approverId) {
      setError("Please select an employee / approver.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const success = await onSubmit({
        department_id: Number(departmentId),
        approver_id: Number(approverId),
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
      <DialogContent className="w-[95vw] sm:max-w-lg md:max-w-xl max-h-[92vh] overflow-y-auto p-0">
        <DialogHeader className="p-6 pb-3 bg-gradient-to-r from-slate-900 to-slate-800 text-white rounded-t-lg">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-primary/20 rounded-xl text-primary-foreground backdrop-blur-sm">
              <UserPlus className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold">
                Assign Approver to Hierarchy
              </DialogTitle>
              <DialogDescription className="text-slate-300 text-xs">
                Designate statutory reviewer for CSC Form No. 6 leave applications.
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

          {/* Department Selection */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-foreground">
              Target Department *
            </Label>
            <Select
              value={departmentId}
              onValueChange={(val) => {
                setDepartmentId(val);
                setError(null);
              }}
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
              Approval Hierarchy Level *
            </Label>
            <Select
              value={level}
              onValueChange={(val) => {
                setLevel(val);
                setError(null);
              }}
            >
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

          {/* Employee Selection */}
          <div className="space-y-1.5 pt-1">
            <Label className="text-xs font-semibold text-foreground">
              Select Officer / Personnel *
            </Label>

            {/* Search filter for user list */}
            <div className="relative mb-2">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Filter by name, position, or email..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                className="pl-8 h-8 text-xs"
              />
            </div>

            <div className="border rounded-lg max-h-48 overflow-y-auto divide-y bg-background">
              {filteredUsers.length > 0 ? (
                filteredUsers.map((u) => {
                  const isSelected = approverId === String(u.user_id);
                  return (
                    <div
                      key={u.user_id}
                      onClick={() => {
                        setApproverId(String(u.user_id));
                        setError(null);
                      }}
                      className={`p-2.5 text-xs cursor-pointer transition-colors flex items-center justify-between ${
                        isSelected
                          ? "bg-primary/10 text-primary font-semibold"
                          : "hover:bg-muted/50"
                      }`}
                    >
                      <div>
                        <p className="font-semibold text-foreground">
                          {u.user_fname} {u.user_lname}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {u.user_position} {u.user_email ? `• ${u.user_email}` : ""}
                        </p>
                      </div>
                      {isSelected && (
                        <div className="h-2 w-2 rounded-full bg-primary" />
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="p-4 text-center text-xs text-muted-foreground">
                  No personnel matching &quot;{userSearch}&quot;
                </div>
              )}
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
              {submitting ? "Assigning..." : "Save Approver"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
