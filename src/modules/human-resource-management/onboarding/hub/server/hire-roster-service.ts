import { z } from "zod";

import { dFetch } from "@/modules/human-resource-management/shared/utils/directus";
import { listOnboardingTasks } from "@/modules/human-resource-management/onboarding/tasks/server/onboarding-task-service";
import { listOnboardingTaskTemplates } from "@/modules/human-resource-management/onboarding/tasks/server/task-template-service";

import { buildHireRosterRows } from "../rosterBuilder";
import type { HireRosterRow } from "../types/hire-roster.schema";

// hire-roster-service.ts — server-side assembly for the onboarding hub roster
// (todo 27). One read path: the employee-keyed task engine (the only source of
// post-hire truth) + the seeded template catalog + the employee directory for
// display names. Nothing is written; there is no profile scope and no stage
// vocabulary — the roster is a pure projection of the live task set.

export const HIRE_ROSTER_ERROR_CODES = {
  employeeReadFailed: "HIRE_ROSTER_EMPLOYEE_READ_FAILED",
} as const;

const EmployeeNameRowSchema = z.object({
  user_id: z.number().int().positive(),
  user_fname: z.string().nullable(),
  user_lname: z.string().nullable(),
});

function displayName(row: z.infer<typeof EmployeeNameRowSchema>): string {
  const name = [row.user_fname, row.user_lname]
    .filter((part): part is string => part !== null && part.trim() !== "")
    .join(" ")
    .trim();
  return name || `Employee #${row.user_id}`;
}

async function listEmployeeNames(): Promise<
  Array<{ user_id: number; name: string }>
> {
  const body: unknown = await dFetch(
    "/items/user?fields=user_id,user_fname,user_lname&sort=-user_id&limit=-1"
  );
  const parsed = z.object({ data: z.array(EmployeeNameRowSchema) }).safeParse(body);
  if (!parsed.success) {
    throw new Error(
      `${HIRE_ROSTER_ERROR_CODES.employeeReadFailed}: user roster read failed (${JSON.stringify(
        body
      ).slice(0, 300)})`
    );
  }
  return parsed.data.data.map((row) => ({
    user_id: row.user_id,
    name: displayName(row),
  }));
}

/**
 * Builds the enriched hire roster: one row per employee that owns
 * `onboarding_task` rows, with the six hub columns (hire, status/phase, next
 * action, owner, due, blockers).
 * @returns Roster rows, "needs attention" first.
 * @throws `HIRE_ROSTER_EMPLOYEE_READ_FAILED` when the user directory read
 * fails (never a silent empty roster); `ONBOARDING_TASK_*` codes propagate
 * from the task/template reads.
 */
export async function listHireRoster(): Promise<HireRosterRow[]> {
  const [tasks, templates, employees] = await Promise.all([
    listOnboardingTasks({}),
    listOnboardingTaskTemplates(),
    listEmployeeNames(),
  ]);
  return buildHireRosterRows({ tasks, templates, employees });
}
