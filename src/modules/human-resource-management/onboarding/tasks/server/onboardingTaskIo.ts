import { z } from "zod";

import { dFetch } from "@/modules/human-resource-management/shared/utils/directus";

import {
  OnboardingTaskSchema,
  OnboardingTaskTemplateSchema,
  type OnboardingOwnerRole,
  type OnboardingTask,
  type OnboardingTaskStatus,
  type OnboardingTaskTemplate,
} from "../../types/onboarding-task.schema";

// onboardingTaskIo.ts — Directus primitives for the employee-keyed task engine
// (todo 19), the ONLY place `onboarding_task_template` / `onboarding_task`
// rows are read or written. Keys everything to `user_id` — there is no
// `profile_id` / `onboarding_profiles` path anywhere in this module.
//
// Every response is parsed back with the todo-1 record schemas, so a Directus
// error body or a contract drift fails LOUDLY with a coded error instead of
// silently passing raw rows (the todo-6 false-empty lesson: a swallowed error
// must never read as an empty list).

export const ONBOARDING_TASK_ERROR_CODES = {
  invalidInput: "ONBOARDING_TASK_INVALID_INPUT",
  userNotFound: "ONBOARDING_TASK_USER_NOT_FOUND",
  userReadFailed: "ONBOARDING_TASK_USER_READ_FAILED",
  templateReadFailed: "ONBOARDING_TASK_TEMPLATE_READ_FAILED",
  templateWriteFailed: "ONBOARDING_TASK_TEMPLATE_WRITE_FAILED",
  taskReadFailed: "ONBOARDING_TASK_READ_FAILED",
  taskNotFound: "ONBOARDING_TASK_NOT_FOUND",
  taskWriteFailed: "ONBOARDING_TASK_WRITE_FAILED",
} as const;

/** PH wall-time, MySQL-compatible `YYYY-MM-DD HH:mm:ss` (conventions §6). */
export function phTimeNow(): string {
  return new Date().toLocaleString("sv-SE", { timeZone: "Asia/Manila" });
}

function fail(code: string, detail: string): never {
  throw new Error(`${code}: ${detail}`);
}

function parseRowList<T>(
  schema: z.ZodType<T>,
  body: unknown,
  code: string,
  label: string
): T[] {
  const envelope = z.object({ data: z.array(z.unknown()) }).safeParse(body);
  if (!envelope.success) {
    fail(
      code,
      `${label} read failed (${JSON.stringify(body).slice(0, 300)})`
    );
  }
  const rows: T[] = [];
  for (const raw of envelope.data.data) {
    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
      fail(
        code,
        `${label} row contract mismatch (${JSON.stringify(parsed.error.flatten())})`
      );
    }
    rows.push(parsed.data);
  }
  return rows;
}

function parseSingle<T>(
  schema: z.ZodType<T>,
  body: unknown,
  code: string,
  label: string
): T {
  const parsed = z.object({ data: schema }).safeParse(body);
  if (!parsed.success) {
    fail(
      code,
      `${label} write/read failed (${JSON.stringify(body).slice(0, 300)})`
    );
  }
  return parsed.data.data;
}

/** Directus answers FORBIDDEN for an item id the static token cannot see. */
function isAbsentItemError(body: unknown): boolean {
  const errors = (
    body as { errors?: Array<{ extensions?: { code?: string } }> } | null
  )?.errors;
  return Array.isArray(errors) && errors[0]?.extensions?.code === "FORBIDDEN";
}

// ---------------------------------------------------------------------------
// user — the employee key is validated before ANY task write
// ---------------------------------------------------------------------------

const UserIdRowSchema = z.object({ user_id: z.number().int().positive() });

/**
 * @param userId - `user.user_id` (signed INT).
 * @returns True when the employee row exists.
 * @throws Coded error when the lookup itself fails (never a false "missing").
 */
export async function readUserExists(userId: number): Promise<boolean> {
  const body: unknown = await dFetch(
    `/items/user?filter[user_id][_eq]=${userId}&fields=user_id&limit=1`
  );
  const parsed = z.object({ data: z.array(UserIdRowSchema) }).safeParse(body);
  if (!parsed.success) {
    fail(
      ONBOARDING_TASK_ERROR_CODES.userReadFailed,
      `user ${userId} lookup failed (${JSON.stringify(body).slice(0, 300)})`
    );
  }
  return parsed.data.data.length > 0;
}

// ---------------------------------------------------------------------------
// onboarding_task_template — catalog IO (upsert-by-code lives in the service)
// ---------------------------------------------------------------------------

export interface TemplateWriteRow {
  code: string;
  title: string;
  phase: string;
  owner_role: OnboardingOwnerRole;
  is_required: boolean;
  sort_order: number;
  created_at: string;
  created_by: number | null;
  updated_at: string;
  updated_by: number | null;
}

/** All templates, phase/sort order. */
export async function listTemplateRows(): Promise<OnboardingTaskTemplate[]> {
  const body: unknown = await dFetch(
    "/items/onboarding_task_template?sort=sort_order,id&limit=-1"
  );
  return parseRowList(
    OnboardingTaskTemplateSchema,
    body,
    ONBOARDING_TASK_ERROR_CODES.templateReadFailed,
    "onboarding_task_template"
  );
}

export async function createTemplateRows(
  rows: readonly TemplateWriteRow[]
): Promise<OnboardingTaskTemplate[]> {
  const body: unknown = await dFetch("/items/onboarding_task_template", {
    method: "POST",
    body: JSON.stringify(rows),
  });
  return parseRowList(
    OnboardingTaskTemplateSchema,
    body,
    ONBOARDING_TASK_ERROR_CODES.templateWriteFailed,
    "onboarding_task_template create"
  );
}

export async function patchTemplateRow(
  id: number,
  patch: Record<string, unknown>
): Promise<OnboardingTaskTemplate> {
  const body: unknown = await dFetch(`/items/onboarding_task_template/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
  return parseSingle(
    OnboardingTaskTemplateSchema,
    body,
    ONBOARDING_TASK_ERROR_CODES.templateWriteFailed,
    `onboarding_task_template/${id} update`
  );
}

// ---------------------------------------------------------------------------
// onboarding_task — per-employee task IO
// ---------------------------------------------------------------------------

export interface TaskListFilter {
  userId?: number;
  status?: OnboardingTaskStatus;
  ownerRole?: OnboardingOwnerRole;
}

export async function listTaskRows(
  filter: TaskListFilter
): Promise<OnboardingTask[]> {
  const query: string[] = [];
  if (filter.userId !== undefined) {
    query.push(`filter[user_id][_eq]=${filter.userId}`);
  }
  if (filter.status !== undefined) {
    query.push(`filter[status][_eq]=${filter.status}`);
  }
  if (filter.ownerRole !== undefined) {
    query.push(`filter[owner_role][_eq]=${filter.ownerRole}`);
  }
  query.push("sort=id", "limit=500");
  const body: unknown = await dFetch(`/items/onboarding_task?${query.join("&")}`);
  return parseRowList(
    OnboardingTaskSchema,
    body,
    ONBOARDING_TASK_ERROR_CODES.taskReadFailed,
    "onboarding_task"
  );
}

export interface TaskWriteRow {
  user_id: number;
  template_id: number;
  owner_role: OnboardingOwnerRole;
  owner_user_id: number | null;
  status: OnboardingTaskStatus;
  due_date: string | null;
  completed_by: number | null;
  completed_at: string | null;
  notes: string | null;
  created_at: string;
  created_by: number | null;
  updated_at: string;
  updated_by: number | null;
}

/** ONE batch POST for all missing tasks (todo-10 precedent). */
export async function createTaskRows(
  rows: readonly TaskWriteRow[]
): Promise<OnboardingTask[]> {
  const body: unknown = await dFetch("/items/onboarding_task", {
    method: "POST",
    body: JSON.stringify(rows),
  });
  return parseRowList(
    OnboardingTaskSchema,
    body,
    ONBOARDING_TASK_ERROR_CODES.taskWriteFailed,
    "onboarding_task create"
  );
}

/** @returns The task row, or null when the id does not exist. */
export async function readTaskRow(
  id: number
): Promise<OnboardingTask | null> {
  const body: unknown = await dFetch(`/items/onboarding_task/${id}`);
  const parsed = z.object({ data: OnboardingTaskSchema }).safeParse(body);
  if (parsed.success) return parsed.data.data;
  if (isAbsentItemError(body)) return null;
  fail(
    ONBOARDING_TASK_ERROR_CODES.taskReadFailed,
    `onboarding_task/${id} read failed (${JSON.stringify(body).slice(0, 300)})`
  );
}

export async function patchTaskRow(
  id: number,
  patch: Record<string, unknown>
): Promise<OnboardingTask> {
  const body: unknown = await dFetch(`/items/onboarding_task/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
  return parseSingle(
    OnboardingTaskSchema,
    body,
    ONBOARDING_TASK_ERROR_CODES.taskWriteFailed,
    `onboarding_task/${id} update`
  );
}
