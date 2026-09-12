import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { dFetch } from "@/modules/human-resource-management/shared/utils/directus";

import { orientationTopicCode } from "../../orientation/server/orientationTopicIo";
import { patchTemplateRow } from "../../tasks/server/onboardingTaskIo";
import {
  readOnboardingTaskSession,
  sessionActorId,
} from "../../tasks/server/onboardingTaskApiServer";

// requirementsApiServer.ts — shared boundary helpers for the requirements
// CRUD API (todo 13 of onboarding-requirements-config). Session handling
// reuses the todo-19 onboarding-task boundary (same `vos_access_token` cookie,
// same `{success,message}` error envelope); NO role gate lives here — the
// session is decoded for the audit actor only (plan: access is governed
// externally by the platform module authorization).

export {
  serverError,
  unauthorized,
  validationFailed,
} from "../../tasks/server/onboardingTaskApiServer";

export const REQUIREMENTS_ERROR_CODES = {
  rowExists: "REQUIREMENTS_ROW_EXISTS",
  rowNotFound: "REQUIREMENTS_ROW_NOT_FOUND",
  rowReferenced: "REQUIREMENTS_ROW_REFERENCED",
  derivedRow: "REQUIREMENTS_DERIVED_ROW",
  readFailed: "REQUIREMENTS_READ_FAILED",
  writeFailed: "REQUIREMENTS_WRITE_FAILED",
} as const;

export type RequirementsErrorCode =
  (typeof REQUIREMENTS_ERROR_CODES)[keyof typeof REQUIREMENTS_ERROR_CODES];

export type RequirementsSessionVerdict =
  | { ok: true; actorId: number | null }
  | { ok: false };

/** Session read for audit attribution only — never an authorization branch. */
export function readRequirementsSession(
  req: NextRequest
): RequirementsSessionVerdict {
  const session = readOnboardingTaskSession(req);
  if (!session) return { ok: false };
  return { ok: true, actorId: sessionActorId(session) };
}

/** PH wall-time, MySQL-compatible `YYYY-MM-DD HH:mm:ss` (conventions §6). */
export function phTimeNow(): string {
  return new Date().toLocaleString("sv-SE", { timeZone: "Asia/Manila" });
}

/** `?all=1` includes deactivated rows; the default list is active only. */
export function readAllFlag(req: NextRequest): boolean {
  return req.nextUrl.searchParams.get("all") === "1";
}

/** Append helper: one step past the current maximum `sort_order`. */
export function nextSortOrder(rows: readonly { sort_order: number }[]): number {
  let max = 0;
  for (const row of rows) {
    if (row.sort_order > max) max = row.sort_order;
  }
  return max + 10;
}

export function requirementsError(
  status: number,
  code: RequirementsErrorCode,
  message: string
): NextResponse {
  return NextResponse.json({ success: false, code, message }, { status });
}

export function requirementsConflict(
  code: RequirementsErrorCode,
  message: string
): NextResponse {
  return requirementsError(409, code, message);
}

export function requirementsNotFound(message: string): NextResponse {
  return requirementsError(404, REQUIREMENTS_ERROR_CODES.rowNotFound, message);
}

export function invalidId(): NextResponse {
  return NextResponse.json(
    { success: false, message: "Invalid id" },
    { status: 400 }
  );
}

/** Reorder batch must reference rows that exist in the catalog. */
export function assertOrderEntriesExist(
  existingIds: ReadonlySet<number>,
  entries: readonly { id: number }[]
): void {
  const missing = entries
    .filter((entry) => !existingIds.has(entry.id))
    .map((entry) => entry.id);
  if (missing.length > 0) {
    throw new Error(
      `${REQUIREMENTS_ERROR_CODES.rowNotFound}: unknown id(s) ${missing.join(",")}`
    );
  }
}

/**
 * Template batch reorder — `onboardingTaskIo.patchTemplateRow` owns the row
 * write; the one-timestamp sequence lives here because only the requirements
 * surface reorders templates (the other three catalogs carry IO reorder
 * helpers).
 */
export async function reorderTemplateRows(
  entries: readonly { id: number; sort_order: number }[],
  actorId: number | null
): Promise<void> {
  const now = phTimeNow();
  for (const entry of entries) {
    await patchTemplateRow(entry.id, {
      sort_order: entry.sort_order,
      updated_at: now,
      updated_by: actorId,
    });
  }
}

// ---------------------------------------------------------------------------
// Hard-delete guard — a row referenced by a per-employee task is refused
// ---------------------------------------------------------------------------

const CountEnvelopeSchema = z.object({
  data: z.array(
    z.object({
      count: z.union([z.number(), z.string().regex(/^\d+$/).transform(Number)]),
    })
  ),
});

/** @returns The number of `onboarding_task` rows referencing the template. */
export async function countTaskReferences(templateId: number): Promise<number> {
  const body: unknown = await dFetch(
    `/items/onboarding_task?filter[template_id][_eq]=${templateId}&aggregate[count]=*`
  );
  const parsed = CountEnvelopeSchema.safeParse(body);
  if (!parsed.success) {
    throw new Error(
      `${REQUIREMENTS_ERROR_CODES.readFailed}: onboarding_task reference count failed (${JSON.stringify(
        body
      ).slice(0, 300)})`
    );
  }
  return parsed.data.data[0]?.count ?? 0;
}

/** @returns The template id for a code, or null when the code is unknown. */
export async function findTemplateIdByCode(
  code: string
): Promise<number | null> {
  const body: unknown = await dFetch(
    `/items/onboarding_task_template?filter[code][_eq]=${encodeURIComponent(
      code
    )}&fields=id&limit=1`
  );
  const parsed = z
    .object({ data: z.array(z.object({ id: z.number().int().positive() })) })
    .safeParse(body);
  if (!parsed.success) {
    throw new Error(
      `${REQUIREMENTS_ERROR_CODES.readFailed}: onboarding_task_template code lookup failed (${JSON.stringify(
        body
      ).slice(0, 300)})`
    );
  }
  return parsed.data.data[0]?.id ?? null;
}

/** @throws Coded `REQUIREMENTS_ROW_REFERENCED` when a task references it. */
export async function assertTemplateNotReferenced(
  templateId: number
): Promise<void> {
  const references = await countTaskReferences(templateId);
  if (references > 0) {
    throw new Error(
      `${REQUIREMENTS_ERROR_CODES.rowReferenced}: template ${templateId} is referenced by ${references} onboarding task(s)`
    );
  }
}

/**
 * Topic hard-delete guard: checks the topic's DERIVED template (the only way
 * a task can reference a topic). An unknown derived template is unreferenced.
 */
export async function assertTopicNotReferenced(topicCode: string): Promise<void> {
  const templateId = await findTemplateIdByCode(orientationTopicCode(topicCode));
  if (templateId !== null) await assertTemplateNotReferenced(templateId);
}

/** True DELETE for a row that passed the reference guard. */
export async function hardDeleteItem(
  collection: string,
  id: number
): Promise<void> {
  const body: unknown = await dFetch(`/items/${collection}/${id}`, {
    method: "DELETE",
  });
  // dFetch answers null on the Directus 204; anything else is a failure body.
  if (body !== null) {
    throw new Error(
      `${REQUIREMENTS_ERROR_CODES.writeFailed}: ${collection}/${id} hard delete failed (${JSON.stringify(
        body
      ).slice(0, 300)})`
    );
  }
}

function codedDetail(message: string, code: string): string {
  const prefix = `${code}: `;
  return message.startsWith(prefix) ? message.slice(prefix.length) : message;
}

/** Maps coded IO/guard errors to the route HTTP envelope; unknown → 500. */
export function mapRequirementsFailure(error: unknown): NextResponse {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes(REQUIREMENTS_ERROR_CODES.rowReferenced)) {
    return requirementsConflict(
      REQUIREMENTS_ERROR_CODES.rowReferenced,
      `This row cannot be hard-deleted (${codedDetail(
        message,
        REQUIREMENTS_ERROR_CODES.rowReferenced
      )}). Deactivate it instead.`
    );
  }
  if (message.includes(REQUIREMENTS_ERROR_CODES.rowNotFound)) {
    return requirementsNotFound("One or more rows do not exist");
  }
  if (
    message.includes("RECORD_NOT_UNIQUE") ||
    message.toLowerCase().includes("duplicate entry")
  ) {
    return requirementsConflict(
      REQUIREMENTS_ERROR_CODES.rowExists,
      "A row with the same key already exists"
    );
  }
  return NextResponse.json(
    {
      success: false,
      message: "An unexpected error occurred. Please try again later.",
    },
    { status: 500 }
  );
}
