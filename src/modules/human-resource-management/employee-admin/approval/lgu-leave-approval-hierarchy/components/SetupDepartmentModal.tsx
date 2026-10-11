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
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Building2,
  UserCheck,
  ShieldCheck,
  Crown,
  Search,
  CheckCircle2,
  X,
  Layers,
} from "lucide-react";
import {
  DepartmentInfo,
  UserInfo,
  DepartmentHierarchySummary,
  SetupDepartmentHierarchyInput,
  LGU_HIERARCHY_LEVELS,
} from "../types";

interface SetupDepartmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  departmentSummary: DepartmentHierarchySummary | null;
  users: UserInfo[];
  onSubmit: (data: SetupDepartmentHierarchyInput) => Promise<boolean>;
}

export function SetupDepartmentModal({
  isOpen,
  onClose,
  departmentSummary,
  users,
  onSubmit,
}: SetupDepartmentModalProps) {
  const [level1Id, setLevel1Id] = useState<number | null>(null);
  const [level2Id, setLevel2Id] = useState<number | null>(null);
  const [level3Id, setLevel3Id] = useState<number | null>(null);

  const [activePickerLevel, setActivePickerLevel] = useState<1 | 2 | 3 | null>(null);
  const [userSearch, setUserSearch] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (departmentSummary && isOpen) {
      setLevel1Id(departmentSummary.level1Approver?.approver_id || null);
      setLevel2Id(departmentSummary.level2Approver?.approver_id || null);
      setLevel3Id(departmentSummary.level3Approver?.approver_id || null);
      setActivePickerLevel(null);
      setUserSearch("");
    }
  }, [departmentSummary, isOpen]);

  if (!departmentSummary) return null;

  const getUserById = (id: number | null) => {
    if (!id) return null;
    return users.find((u) => u.user_id === id) || null;
  };

  const level1User = getUserById(level1Id);
  const level2User = getUserById(level2Id);
  const level3User = getUserById(level3Id);

  const filteredUsers = users.filter((u) => {
    const q = userSearch.toLowerCase();
    const fullName = `${u.user_fname} ${u.user_lname}`.toLowerCase();
    return (
      fullName.includes(q) ||
      u.user_position.toLowerCase().includes(q) ||
      u.user_email.toLowerCase().includes(q)
    );
  });

  const handleSelectUserForLevel = (user: UserInfo) => {
    if (activePickerLevel === 1) setLevel1Id(user.user_id);
    if (activePickerLevel === 2) setLevel2Id(user.user_id);
    if (activePickerLevel === 3) setLevel3Id(user.user_id);
    setActivePickerLevel(null);
    setUserSearch("");
  };

  const handleClearLevel = (lvl: 1 | 2 | 3) => {
    if (lvl === 1) setLevel1Id(null);
    if (lvl === 2) setLevel2Id(null);
    if (lvl === 3) setLevel3Id(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const success = await onSubmit({
        department_id: departmentSummary.department.department_id,
        level1_approver_id: level1Id,
        level2_approver_id: level2Id,
        level3_approver_id: level3Id,
      });
      if (success) {
        onClose();
      }
    } finally {
      setSubmitting(false);
    }
  };

  const levelCards = [
    {
      level: 1 as const,
      title: "Level 1: Recommending Officer",
      subtitle: "Immediate Supervisor / Department Head (Sec. 7.B)",
      icon: UserCheck,
      color: "text-indigo-500",
      bgLight: "bg-indigo-500/10",
      border: "border-indigo-500/20",
      selectedUser: level1User,
    },
    {
      level: 2 as const,
      title: "Level 2: Credit Certification",
      subtitle: "HRMO Officer / HR Head (Sec. 7.A)",
      icon: ShieldCheck,
      color: "text-purple-500",
      bgLight: "bg-purple-500/10",
      border: "border-purple-500/20",
      selectedUser: level2User,
    },
    {
      level: 3 as const,
      title: "Level 3: Head of Agency",
      subtitle: "Municipal Mayor / Local Chief Executive (Sec. 7.C)",
      icon: Crown,
      color: "text-emerald-500",
      bgLight: "bg-emerald-500/10",
      border: "border-emerald-500/20",
      selectedUser: level3User,
    },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[95vw] sm:max-w-2xl max-h-[92vh] overflow-y-auto p-0">
        <DialogHeader className="p-6 pb-3 bg-gradient-to-r from-slate-900 to-slate-800 text-white rounded-t-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-primary/20 rounded-xl text-primary-foreground backdrop-blur-sm">
                <Building2 className="h-5 w-5 text-emerald-400" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold">
                  Setup Department Approval Hierarchy
                </DialogTitle>
                <DialogDescription className="text-slate-300 text-xs">
                  Configure the complete 3-tier statutory review chain for {departmentSummary.department.department_name}.
                </DialogDescription>
              </div>
            </div>

            <Badge variant="outline" className="text-xs bg-white/10 text-white border-white/20">
              Dept #{departmentSummary.department.department_id}
            </Badge>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Active Department Banner */}
          <div className="p-3.5 bg-muted/40 rounded-xl border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" />
              <div>
                <p className="font-bold text-xs text-foreground">
                  {departmentSummary.department.department_name}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Department Head: {departmentSummary.department.department_head || "Not designated"}
                </p>
              </div>
            </div>

            <div className="text-right">
              <span className="text-[11px] font-semibold text-muted-foreground block">
                Completion
              </span>
              <span className="text-xs font-bold text-foreground">
                {[level1Id, level2Id, level3Id].filter(Boolean).length} of 3 Levels Assigned
              </span>
            </div>
          </div>

          {/* User Picker Drawer / In-modal search when picking */}
          {activePickerLevel ? (
            <div className="border rounded-xl p-4 bg-muted/20 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-foreground">
                    Assigning Approver for Level {activePickerLevel}
                  </span>
                  <Badge variant="secondary" className="text-[10px]">
                    {activePickerLevel === 1 ? "Supervisor" : activePickerLevel === 2 ? "HRMO" : "Mayor"}
                  </Badge>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => {
                    setActivePickerLevel(null);
                    setUserSearch("");
                  }}
                >
                  <X className="h-3.5 w-3.5 mr-1" />
                  Cancel Selection
                </Button>
              </div>

              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  autoFocus
                  placeholder="Search personnel by name, position, or email..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="pl-8 h-8 text-xs bg-background"
                />
              </div>

              <div className="border rounded-lg max-h-44 overflow-y-auto divide-y bg-background">
                {filteredUsers.length > 0 ? (
                  filteredUsers.map((u) => (
                    <div
                      key={u.user_id}
                      onClick={() => handleSelectUserForLevel(u)}
                      className="p-2.5 text-xs hover:bg-muted/50 cursor-pointer flex items-center justify-between transition-colors"
                    >
                      <div>
                        <p className="font-semibold text-foreground">
                          {u.user_fname} {u.user_lname}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {u.user_position} {u.user_email ? `• ${u.user_email}` : ""}
                        </p>
                      </div>
                      <Button size="sm" variant="ghost" className="h-6 text-[11px] text-primary">
                        Select
                      </Button>
                    </div>
                  ))
                ) : (
                  <div className="p-4 text-center text-xs text-muted-foreground">
                    No personnel matching "{userSearch}"
                  </div>
                )}
              </div>
            </div>
          ) : null}

          {/* 3 Level Rows */}
          <div className="space-y-3">
            {levelCards.map((card) => {
              const Icon = card.icon;
              const user = card.selectedUser;

              return (
                <div
                  key={card.level}
                  className={`border rounded-xl p-4 bg-card transition-all ${
                    user ? card.border : "border-dashed border-border"
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2">
                    <div className="flex items-center gap-2">
                      <div className={`p-1.5 rounded-lg ${card.bgLight} ${card.color}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-foreground">
                          {card.title}
                        </h4>
                        <p className="text-[11px] text-muted-foreground font-medium">
                          {card.subtitle}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {user ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs text-muted-foreground hover:text-foreground"
                          onClick={() => {
                            setActivePickerLevel(card.level);
                            setUserSearch("");
                          }}
                        >
                          Change
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs border-dashed text-primary font-medium"
                          onClick={() => {
                            setActivePickerLevel(card.level);
                            setUserSearch("");
                          }}
                        >
                          + Assign Officer
                        </Button>
                      )}

                      {user && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-rose-500"
                          onClick={() => handleClearLevel(card.level)}
                          title="Remove from this level"
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Assigned Officer Status Card */}
                  {user ? (
                    <div className="p-2.5 rounded-lg bg-muted/30 border flex items-center justify-between mt-2">
                      <div className="flex items-center gap-2.5">
                        <div className="h-7 w-7 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center text-xs">
                          {user.user_fname[0]}
                          {user.user_lname[0]}
                        </div>
                        <div>
                          <p className="font-bold text-xs text-foreground">
                            {user.user_fname} {user.user_lname}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            {user.user_position} {user.user_email ? `• ${user.user_email}` : ""}
                          </p>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                        Active Approver
                      </Badge>
                    </div>
                  ) : (
                    <div className="p-2 text-center text-xs text-muted-foreground italic bg-muted/10 rounded-lg border border-dashed mt-2">
                      No approver assigned. Leave applications will stall at this level.
                    </div>
                  )}
                </div>
              );
            })}
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
              {submitting ? "Saving Department Setup..." : "Save Department Hierarchy"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
