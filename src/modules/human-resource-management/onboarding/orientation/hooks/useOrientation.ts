"use client";

import { useCallback, useEffect, useState } from "react";

import { useOnboardingProfileFetch } from "../../hub/providers/profileProvider";
import { useOrientationFetch } from "../providers/orientationProvider";
import type { OrientationRole } from "../types/orientation.schema";

// useOrientation.ts — Orientation tab intent hook: hire selection (from the
// hub profiles collection-use) + per-hire topic state + role-gated
// check-off. 403 reasons surface via the returned error as-is.

export function useOrientation() {
  const { profiles } = useOnboardingProfileFetch();
  const {
    topics,
    checks,
    done,
    isLoading,
    isError,
    error,
    loadHire,
    checkOff,
  } = useOrientationFetch();

  const [profileId, setProfileId] = useState<number | null>(null);
  const [role, setRole] = useState<OrientationRole>("hr");
  const [actionError, setActionError] = useState<string | null>(null);
  const [checkingId, setCheckingId] = useState<string | null>(null);

  useEffect(() => {
    if (profileId === null && profiles.length > 0) {
      const first = profiles[0];
      if (first) {
        setProfileId(first.employee_id);
        void loadHire(first.employee_id);
      }
    }
  }, [profiles, profileId, loadHire]);

  const selectHire = useCallback(
    (id: number) => {
      setProfileId(id);
      setActionError(null);
      void loadHire(id);
    },
    [loadHire]
  );

  const checkTopic = useCallback(
    async (topicId: string) => {
      if (profileId === null) return;
      setCheckingId(topicId);
      setActionError(null);
      try {
        await checkOff(profileId, topicId, role);
      } catch (err) {
        setActionError(err instanceof Error ? err.message : String(err));
      } finally {
        setCheckingId(null);
      }
    },
    [profileId, role, checkOff]
  );

  const checkedIds = new Set(checks.map((c) => c.topic_id));
  const companyTopics = topics.filter((t) => t.track === "company");
  const departmentTopics = topics.filter((t) => t.track === "department");

  return {
    profiles,
    profileId,
    selectHire,
    role,
    setRole,
    companyTopics,
    departmentTopics,
    checkedIds,
    done,
    isLoading,
    isError,
    error,
    actionError,
    checkingId,
    checkTopic,
  };
}
