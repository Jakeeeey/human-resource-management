"use client";

import { useCallback, useEffect, useState } from "react";
import { z } from "zod";

import {
  OnboardingTaskSchema,
  OnboardingTaskTemplateSchema,
} from "@/modules/human-resource-management/onboarding/types/onboarding-task.schema";

import {
  HireRosterResponseSchema,
  type HireRosterRow,
} from "../types/hire-roster.schema";
import {
  buildWorkspacePhaseGroups,
  type WorkspacePhaseGroup,
} from "../workspaceTasks";

// useHireWorkspace.ts — client data access for the per-hire workspace
// (todo 28). Three reads assembled for one employee: the enriched roster row
// (summary), the employee's task set, and the template catalog (phase/title
// join). Every response is boundary-parsed so a Directus error envelope or
// contract drift surfaces as an error state instead of a silent empty
// workspace (the todo-6 false-empty lesson).

const ROSTER_URL = "/api/hrm/onboarding/hire-roster";
const TASKS_URL = "/api/hrm/onboarding/onboarding-task";
const TEMPLATES_URL = "/api/hrm/onboarding/onboarding-task-template";

const TaskListResponseSchema = z.object({
  success: z.boolean(),
  data: z.array(OnboardingTaskSchema).optional(),
});

const TemplateListResponseSchema = z.object({
  success: z.boolean(),
  data: z.array(OnboardingTaskTemplateSchema).optional(),
});

export interface HireWorkspaceState {
  row: HireRosterRow | null;
  phaseGroups: WorkspacePhaseGroup[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useHireWorkspace(userId: number): HireWorkspaceState {
  const [row, setRow] = useState<HireRosterRow | null>(null);
  const [phaseGroups, setPhaseGroups] = useState<WorkspacePhaseGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const [rosterRes, tasksRes, templatesRes] = await Promise.all([
        fetch(ROSTER_URL, { cache: "no-store" }),
        fetch(`${TASKS_URL}?user_id=${userId}`, { cache: "no-store" }),
        fetch(TEMPLATES_URL, { cache: "no-store" }),
      ]);
      const [rosterBody, tasksBody, templatesBody] = await Promise.all([
        rosterRes.json().catch(() => null),
        tasksRes.json().catch(() => null),
        templatesRes.json().catch(() => null),
      ]);

      const roster = HireRosterResponseSchema.safeParse(rosterBody);
      if (!rosterRes.ok || !roster.success || !roster.data.success) {
        throw new Error("Failed to load this hire.");
      }
      const tasks = TaskListResponseSchema.safeParse(tasksBody);
      if (!tasksRes.ok || !tasks.success || !tasks.data.success) {
        throw new Error("Failed to load this hire's onboarding tasks.");
      }
      const templates = TemplateListResponseSchema.safeParse(templatesBody);
      if (!templatesRes.ok || !templates.success || !templates.data.success) {
        throw new Error("Failed to load the onboarding task catalog.");
      }

      setRow(
        (roster.data.data?.hires ?? []).find(
          (hire) => hire.userId === userId
        ) ?? null
      );
      setPhaseGroups(
        buildWorkspacePhaseGroups(
          tasks.data.data ?? [],
          templates.data.data ?? []
        )
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load this workspace."
      );
      setRow(null);
      setPhaseGroups([]);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { row, phaseGroups, loading, error, refresh };
}
