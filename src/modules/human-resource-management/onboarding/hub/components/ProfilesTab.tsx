"use client";

import { useOnboardingProfiles } from "../hooks/useOnboardingProfiles";
import { ProfilesTable } from "./ProfilesTable";
import { ProfileDialog } from "./ProfileDialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertCircle, Plus, RefreshCw } from "lucide-react";

// ProfilesTab.tsx — profile CRUD round-trip surface: toolbar (new + retry),
// table, create/edit dialog. Hook-created rows (FOR_ONBOARDING) appear here.

export function ProfilesTab() {
  const {
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
  } = useOnboardingProfiles();

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          {profiles.length} profile{profiles.length === 1 ? "" : "s"} on file
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            variant="outline"
            onClick={() => void refetch()}
            disabled={isLoading}
            className="w-full sm:w-auto"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button onClick={openCreate} className="w-full sm:w-auto">
            <Plus className="mr-2 h-4 w-4" />
            New profile
          </Button>
        </div>
      </div>

      {isError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Could not load profiles</AlertTitle>
          <AlertDescription>
            {error?.message ?? "Fetch failed"}
          </AlertDescription>
        </Alert>
      )}

      <ProfilesTable
        profiles={profiles}
        isLoading={isLoading}
        onEdit={openEdit}
        onAdvance={(p) => void advanceStatus(p)}
        onAccept={(p) => void recordAcceptance(p)}
      />

      <ProfileDialog
        open={dialogOpen}
        profile={selected}
        saving={saving}
        onClose={closeDialog}
        onSave={(d) => void saveProfile(d)}
      />
    </div>
  );
}
