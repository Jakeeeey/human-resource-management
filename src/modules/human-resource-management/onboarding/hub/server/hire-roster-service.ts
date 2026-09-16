import { z } from "zod";

import { dFetch } from "@/modules/human-resource-management/shared/utils/directus";
import { listOnboardingTasks } from "@/modules/human-resource-management/onboarding/tasks/server/onboarding-task-service";
import { listOnboardingTaskTemplates } from "@/modules/human-resource-management/onboarding/tasks/server/task-template-service";

import { buildHireRosterRows, UNNAMED_EMPLOYEE_LABEL } from "../rosterBuilder";
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
  user_dateOfHire: z.string().nullish(),
  user_department: z.number().int().nullable(),
  user_position: z.string().nullable(),
});

function displayName(row: z.infer<typeof EmployeeNameRowSchema>): string {
  const name = [row.user_fname, row.user_lname]
    .filter((part): part is string => part !== null && part.trim() !== "")
    .join(" ")
    .trim();
  return name || UNNAMED_EMPLOYEE_LABEL;
}

async function listEmployeeNames(): Promise<
  Array<{
    user_id: number;
    name: string;
    dateHired: string | null;
    departmentId: number | null;
    position: string | null;
  }>
> {
  const body: unknown = await dFetch(
    "/items/user?fields=user_id,user_fname,user_lname,user_dateOfHire,user_department,user_position&sort=-user_id&limit=-1"
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
    dateHired: row.user_dateOfHire ?? null,
    departmentId:
      typeof row.user_department === "number" && row.user_department > 0
        ? row.user_department
        : null,
    position:
      typeof row.user_position === "string" && row.user_position.trim() !== ""
        ? row.user_position.trim()
        : null,
  }));
}

async function listDepartmentNames(
  ids: readonly number[]
): Promise<Map<number, string>> {
  const names = new Map<number, string>();
  if (ids.length === 0) return names;
  const body: unknown = await dFetch(
    `/items/department?filter[department_id][_in]=${ids.join(",")}&fields=department_id,department_name&limit=-1`
  );
  const parsed = z
    .object({
      data: z.array(
        z.object({
          department_id: z.number().int(),
          department_name: z.string().nullable(),
        })
      ),
    })
    .safeParse(body);
  if (!parsed.success) {
    throw new Error(
      `${HIRE_ROSTER_ERROR_CODES.employeeReadFailed}: department directory read failed (${JSON.stringify(
        body
      ).slice(0, 300)})`
    );
  }
  for (const row of parsed.data.data) {
    const name = row.department_name?.trim() || "";
    if (name) names.set(row.department_id, name);
  }
  return names;
}

/**
 * Builds the enriched hire roster: one row per employee that owns
 * `onboarding_task` rows, with hire, status/phase, and date hired.
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
  const departmentIds = [
    ...new Set(
      employees
        .map((employee) => employee.departmentId)
        .filter((id): id is number => id !== null)
    ),
  ];
  const departmentNames = await listDepartmentNames(departmentIds);
  return buildHireRosterRows({
    tasks,
    templates,
    employees: employees.map((employee) => ({
      user_id: employee.user_id,
      name: employee.name,
      dateHired: employee.dateHired,
      department:
        employee.departmentId !== null
          ? (departmentNames.get(employee.departmentId) ?? null)
          : null,
      position: employee.position,
    })),
  });
}
