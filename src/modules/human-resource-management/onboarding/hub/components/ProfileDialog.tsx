"use client";

import { useState } from "react";
import type {
  CreateOnboardingProfileInput,
  OnboardingProfile,
} from "../types/onboarding-profile.schema";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// ProfileDialog.tsx — create/edit + offer-acceptance record feeding profile
// creation (offer_accepted checkbox + start_date + application bridge).
// Form state initializes from props on mount; the dialog remounts it via
// `key` per open/profile so no set-state-in-effect is needed. Footer stacks
// on mobile (w-full sm:w-auto).

interface ProfileDialogProps {
  open: boolean;
  profile: OnboardingProfile | null;
  saving: boolean;
  onClose: () => void;
  onSave: (data: CreateOnboardingProfileInput) => void;
}

function ProfileDialogForm({
  profile,
  saving,
  onClose,
  onSave,
}: Omit<ProfileDialogProps, "open">) {
  const [employeeId, setEmployeeId] = useState(
    profile ? String(profile.employee_id) : ""
  );
  const [applicationId, setApplicationId] = useState(
    profile?.application_id ? String(profile.application_id) : ""
  );
  const [offerAccepted, setOfferAccepted] = useState(
    profile?.offer_accepted ?? false
  );
  const [startDate, setStartDate] = useState(profile?.start_date ?? "");

  const handleSave = () => {
    const parsed = Number(employeeId);
    if (!Number.isInteger(parsed) || parsed <= 0) return;
    const appParsed =
      applicationId.trim() === "" ? null : Number(applicationId);
    onSave({
      employee_id: parsed,
      application_id:
        appParsed !== null && Number.isInteger(appParsed) && appParsed > 0
          ? appParsed
          : null,
      offer_accepted: offerAccepted,
      start_date: startDate.trim() === "" ? null : startDate.trim(),
    });
  };

  return (
    <>
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="onb-employee-id">Employee ID</Label>
          <Input
            id="onb-employee-id"
            inputMode="numeric"
            value={employeeId}
            disabled={profile !== null || saving}
            onChange={(e) => setEmployeeId(e.target.value)}
            placeholder="Spring employee id"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="onb-application-id">
            Application ID (bridge, optional)
          </Label>
          <Input
            id="onb-application-id"
            inputMode="numeric"
            value={applicationId}
            disabled={saving}
            onChange={(e) => setApplicationId(e.target.value)}
            placeholder="Linked application, if known"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="onb-start-date">Start date (optional)</Label>
          <Input
            id="onb-start-date"
            type="date"
            value={startDate}
            disabled={saving}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>
        <label
          htmlFor="onb-offer-accepted"
          className="flex min-h-8 cursor-pointer items-center gap-2 text-sm"
        >
          <input
            id="onb-offer-accepted"
            type="checkbox"
            className="h-4 w-4"
            checked={offerAccepted}
            disabled={saving}
            onChange={(e) => setOfferAccepted(e.target.checked)}
          />
          Offer accepted (acceptance record feeds profile creation)
        </label>
      </div>
      <DialogFooter className="flex-col gap-2 sm:flex-row">
        <Button
          variant="outline"
          onClick={onClose}
          disabled={saving}
          className="w-full sm:w-auto"
        >
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          disabled={saving}
          className="w-full sm:w-auto"
        >
          {saving ? "Saving…" : "Save"}
        </Button>
      </DialogFooter>
    </>
  );
}

export function ProfileDialog({
  open,
  profile,
  saving,
  onClose,
  onSave,
}: ProfileDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="w-[95vw] rounded-2xl max-h-[90vh] overflow-y-auto sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {profile ? "Edit onboarding profile" : "New onboarding profile"}
          </DialogTitle>
        </DialogHeader>
        {open && (
          <ProfileDialogForm
            key={profile?.id ?? "new"}
            profile={profile}
            saving={saving}
            onClose={onClose}
            onSave={onSave}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
