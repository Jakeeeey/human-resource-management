"use client";

// useOnboardingProfiles.ts — selection + dialog + status-advance intents over
// the profile fetch provider. Transition errors (400 reason strings from the
// machine gate) surface as-is so HR sees why an advance was refused.

import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import type {
  CreateOnboardingProfileInput,
  OnboardingProfile,
} from "../types/onboarding-profile.schema";
import { STATUS_ORDER } from "../statusMachine";
import type { OnboardingStatus } from "../types/onboarding-profile.schema";
import { useOnboardingProfileFetch } from "../providers/profileProvider";

export function useOnboardingProfiles() {
  const {
    profiles,
    isLoading,
    isError,
    error,
    refetch,
    createProfile,
    updateProfile,
  } = useOnboardingProfileFetch();

  const [selected, setSelected] = useState<OnboardingProfile | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const openCreate = useCallback(() => {
    setSelected(null);
    setDialogOpen(true);
  }, []);

  const openEdit = useCallback((profile: OnboardingProfile) => {
    setSelected(profile);
    setDialogOpen(true);
  }, []);

  const closeDialog = useCallback(() => {
    setDialogOpen(false);
    setSelected(null);
  }, []);

  const saveProfile = useCallback(
    async (data: CreateOnboardingProfileInput) => {
      setSaving(true);
      try {
        if (selected) {
          await updateProfile(selected.id, {
            application_id: data.application_id ?? null,
            offer_accepted: data.offer_accepted,
            start_date: data.start_date ?? null,
          });
          toast.success("Profile updated");
        } else {
          await createProfile(data);
          toast.success("Profile created");
        }
        closeDialog();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Save failed");
      } finally {
        setSaving(false);
      }
    },
    [selected, createProfile, updateProfile, closeDialog]
  );

  const advanceStatus = useCallback(
    async (profile: OnboardingProfile) => {
      const rank = STATUS_ORDER.indexOf(profile.status);
      const next: OnboardingStatus | undefined = STATUS_ORDER[rank + 1];
      if (!next) {
        toast.info("Profile already at final status");
        return;
      }
      setSaving(true);
      try {
        await updateProfile(profile.id, { status: next });
        toast.success(`Advanced to ${next}`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Advance refused");
      } finally {
        setSaving(false);
      }
    },
    [updateProfile]
  );

  const recordAcceptance = useCallback(
    async (profile: OnboardingProfile) => {
      setSaving(true);
      try {
        await updateProfile(profile.id, { offer_accepted: true });
        toast.success("Offer acceptance recorded");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Record failed");
      } finally {
        setSaving(false);
      }
    },
    [updateProfile]
  );

  return useMemo(
    () => ({
      profiles,
      isLoading,
      isError,
      error,
      refetch,
      selected,
      dialogOpen,
      saving,
      openCreate,
      openEdit,
      closeDialog,
      saveProfile,
      advanceStatus,
      recordAcceptance,
    }),
    [
      profiles,
      isLoading,
      isError,
      error,
      refetch,
      selected,
      dialogOpen,
      saving,
      openCreate,
      openEdit,
      closeDialog,
      saveProfile,
      advanceStatus,
      recordAcceptance,
    ]
  );
}
