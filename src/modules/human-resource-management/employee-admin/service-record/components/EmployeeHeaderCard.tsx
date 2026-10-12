"use client";

import React, { useState } from "react";
import { format } from "date-fns";
import { User, Calendar, MapPin, CreditCard, Edit3, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import type { EmployeeProfile } from "../type";
import { updateEmployeeHeader } from "../providers/serviceRecordProvider";

interface EmployeeHeaderCardProps {
  employee: EmployeeProfile;
  isStillInService: boolean;
  onRefresh: () => void;
}

export function EmployeeHeaderCard({
  employee,
  isStillInService,
  onRefresh,
}: EmployeeHeaderCardProps) {
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Form states
  const [maidenName, setMaidenName] = useState(employee.user_maiden_name || "");
  const [birthDate, setBirthDate] = useState(employee.user_bday || "");
  const [birthPlace, setBirthPlace] = useState(employee.user_birth_place || "");
  const [bpNumber, setBpNumber] = useState(employee.user_bp_number || "");
  const [separationDate, setSeparationDate] = useState(employee.separation_date || "");
  const [separationCause, setSeparationCause] = useState(employee.separation_cause || "");

  const handleOpenEdit = () => {
    setMaidenName(employee.user_maiden_name || "");
    setBirthDate(employee.user_bday || "");
    setBirthPlace(employee.user_birth_place || "");
    setBpNumber(employee.user_bp_number || "");
    setSeparationDate(employee.separation_date || "");
    setSeparationCause(employee.separation_cause || "");
    setIsEditOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSaving(true);
      await updateEmployeeHeader(employee.user_id, {
        user_maiden_name: maidenName.trim() || null,
        user_bday: birthDate || null,
        user_birth_place: birthPlace.trim() || null,
        user_bp_number: bpNumber.trim() || null,
        separation_date: separationDate || null,
        separation_cause: separationCause.trim() || null,
      });
      toast.success("Employee details updated successfully");
      setIsEditOpen(false);
      onRefresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update employee details");
    } finally {
      setIsSaving(false);
    }
  };

  const formattedBday = employee.user_bday
    ? format(new Date(employee.user_bday), "MMMM dd, yyyy")
    : "Not recorded";

  return (
    <>
      <div className="bg-card/70 border border-border/60 rounded-2xl p-5 shadow-sm backdrop-blur-xs space-y-4">
        {/* Top Header Row */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-border/40 pb-4">
          <div className="flex items-center gap-3.5">
            <div className="h-12 w-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold text-base shadow-inner">
              {employee.user_fname?.[0]}
              {employee.user_lname?.[0]}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-black tracking-tight text-foreground">
                  {employee.user_lname}, {employee.user_fname} {employee.user_mname || ""}
                </h2>
                {isStillInService ? (
                  <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 gap-1 text-[11px] font-bold rounded-full">
                    <CheckCircle2 className="h-3 w-3" />
                    Still in the Service (Active)
                  </Badge>
                ) : (
                  <Badge className="bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30 gap-1 text-[11px] font-bold rounded-full">
                    <AlertCircle className="h-3 w-3" />
                    Separated {employee.separation_date ? `(${format(new Date(employee.separation_date), "MMM dd, yyyy")})` : ""}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {employee.user_position || "No Position"} • {employee.department_name || "General Department"} • ID: {employee.user_id}
              </p>
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleOpenEdit}
            className="rounded-xl h-9 text-xs font-bold gap-1.5 border-border/60 hover:bg-muted"
          >
            <Edit3 className="h-3.5 w-3.5 text-primary" />
            Edit Header Details
          </Button>
        </div>

        {/* 4-Column Metadata Display */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-1">
          {/* Maiden Name */}
          <div className="bg-background/50 border border-border/40 rounded-xl p-3 flex flex-col gap-1">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <User className="h-3 w-3 text-primary/70" />
              Full Maiden Name
            </span>
            <span className="text-sm font-bold text-foreground truncate">
              {employee.user_maiden_name || <span className="text-muted-foreground font-normal italic">None</span>}
            </span>
          </div>

          {/* Birth Date */}
          <div className="bg-background/50 border border-border/40 rounded-xl p-3 flex flex-col gap-1">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Calendar className="h-3 w-3 text-primary/70" />
              Birth Date
            </span>
            <span className="text-sm font-bold text-foreground">
              {formattedBday}
            </span>
          </div>

          {/* Birth Place */}
          <div className="bg-background/50 border border-border/40 rounded-xl p-3 flex flex-col gap-1">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <MapPin className="h-3 w-3 text-primary/70" />
              Birth Place
            </span>
            <span className="text-sm font-bold text-foreground truncate">
              {employee.user_birth_place || <span className="text-muted-foreground font-normal italic">Not specified</span>}
            </span>
          </div>

          {/* BP Number */}
          <div className="bg-background/50 border border-border/40 rounded-xl p-3 flex flex-col gap-1">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <CreditCard className="h-3 w-3 text-primary/70" />
              GSIS BP Number
            </span>
            <span className="text-sm font-black font-mono text-primary truncate">
              {employee.user_bp_number || <span className="text-muted-foreground font-normal italic font-sans">None</span>}
            </span>
          </div>
        </div>
      </div>

      {/* Edit Header Modal */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-black tracking-tight">
              Edit Service Record Header
            </DialogTitle>
            <DialogDescription className="text-xs">
              Update information that appears on the official Service Record header for {employee.user_fname} {employee.user_lname}.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Full Maiden Name (If married)</Label>
              <Input
                placeholder="e.g. ANNE CURTIS SMITH"
                value={maidenName}
                onChange={(e) => setMaidenName(e.target.value)}
                className="h-9 rounded-xl text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Birth Date</Label>
                <Input
                  type="date"
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                  className="h-9 rounded-xl text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Birth Place</Label>
                <Input
                  placeholder="e.g. Borongan City"
                  value={birthPlace}
                  onChange={(e) => setBirthPlace(e.target.value)}
                  className="h-9 rounded-xl text-xs"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold">GSIS BP Number (Govt ID)</Label>
              <Input
                placeholder="e.g. 2005226355"
                value={bpNumber}
                onChange={(e) => setBpNumber(e.target.value)}
                className="h-9 rounded-xl text-xs font-mono font-bold"
              />
            </div>

            <div className="pt-2 border-t border-border/40">
              <div className="text-xs font-bold text-muted-foreground mb-2 uppercase tracking-wider">
                Separation Details (Leave blank if Still in the Service)
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Separation Date</Label>
                  <Input
                    type="date"
                    value={separationDate}
                    onChange={(e) => setSeparationDate(e.target.value)}
                    className="h-9 rounded-xl text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Cause of Separation</Label>
                  <Input
                    placeholder="e.g. Resignation, Retirement"
                    value={separationCause}
                    onChange={(e) => setSeparationCause(e.target.value)}
                    className="h-9 rounded-xl text-xs"
                  />
                </div>
              </div>
            </div>

            <DialogFooter className="pt-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditOpen(false)}
                className="rounded-xl h-9 text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSaving}
                className="rounded-xl h-9 text-xs font-bold bg-primary text-primary-foreground"
              >
                {isSaving ? "Saving..." : "Save Details"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
