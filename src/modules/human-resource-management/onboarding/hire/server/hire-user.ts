import { z } from "zod";

import { dFetch } from "@/modules/human-resource-management/shared/utils/directus";
import {
  createSpringUser,
  type SpringUserCreatePayload,
} from "@/modules/human-resource-management/shared/services/spring-user-service";

import { HIRE_ORCHESTRATOR_ERROR_CODES } from "../types/hire.schema";

// hire-user.ts — idempotent Spring employee resolution for the post-hire
// orchestrator (todo 16).
//
// IDEMPOTENCY MODEL (task contract):
//   - LOOKUP FIRST: an existing `user` with the applicant's email is reused
//     and NO Spring create is issued (no applicant↔user link is stored).
//   - IN-PROCESS MUTEX: concurrent orchestrations for the same email collapse
//     onto ONE in-flight promise, so a double-fire creates exactly one user;
//     only the run that performs the create reports `created: true` (the
//     coalesced waiters report reuse) so the audit log stays truthful.
//   - DUPLICATE FALLBACK: if Spring still rejects with "already registered"
//     (e.g. the race was won by another process), re-lookup and reuse.
//   - READ-BACK VERIFY: after a create, the user MUST be visible by email;
//     otherwise the run fails loudly (never a misleading success).
// There is NO correlation column anywhere: the returned `user_id` is passed
// to the post-hire steps within the same orchestration run.

const UserIdListSchema = z.object({
  data: z.array(z.object({ user_id: z.number().int().positive() })),
});

export interface ResolvedHireUser {
  userId: number;
  /** True when THIS resolution created the Spring user; false = reused. */
  created: boolean;
}

/** One in-flight resolution per normalized email (concurrency guard). */
const inFlightByEmail = new Map<string, Promise<ResolvedHireUser>>();

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Lists every `user.user_id` stored for an email (ascending), via Directus.
 * @param normalizedEmail - Lowercased/trimmed email.
 * @returns All matching user ids (possibly empty).
 * @throws Error with `HIRE_ORCHESTRATOR_ERROR_CODES.readFailed` on a Directus
 * error body (never a false-empty list).
 */
async function listUserIdsByEmail(normalizedEmail: string): Promise<number[]> {
  const body: unknown = await dFetch(
    `/items/user?filter[user_email][_eq]=${encodeURIComponent(normalizedEmail)}&fields=user_id&sort=user_id&limit=50`
  );
  const parsed = UserIdListSchema.safeParse(body);
  if (!parsed.success) {
    throw new Error(
      `${HIRE_ORCHESTRATOR_ERROR_CODES.readFailed}: user lookup for an email failed (${JSON.stringify(body).slice(0, 300)})`
    );
  }
  return parsed.data.data.map((row) => row.user_id);
}

/**
 * @param normalizedEmail - Lowercased/trimmed email.
 * @returns The oldest matching user id, or null when none exists.
 */
async function findUserByEmail(normalizedEmail: string): Promise<number | null> {
  const ids = await listUserIdsByEmail(normalizedEmail);
  return ids.length > 0 ? ids[0] : null;
}

async function readVosAccessToken(): Promise<string | undefined> {
  try {
    const { cookies } = await import("next/headers");
    const store = await cookies();
    return store.get("vos_access_token")?.value ?? undefined;
  } catch {
    return undefined;
  }
}

async function createOrReuseUser(
  normalizedEmail: string,
  payload: SpringUserCreatePayload,
  authToken: string | undefined
): Promise<ResolvedHireUser> {
  const doubleChecked = await findUserByEmail(normalizedEmail);
  if (doubleChecked !== null) {
    return { userId: doubleChecked, created: false };
  }

  const outcome = await createSpringUser(payload, authToken);

  if (outcome.duplicateEmail) {
    const winner = await findUserByEmail(normalizedEmail);
    if (winner !== null) return { userId: winner, created: false };
    throw new Error(
      `${HIRE_ORCHESTRATOR_ERROR_CODES.userCreateFailed}: Spring rejected the email as already registered but no user row exists for it`
    );
  }

  if (outcome.userId === null) {
    const detail =
      typeof outcome.data === "object" && outcome.data !== null
        ? JSON.stringify(outcome.data).slice(0, 300)
        : String(outcome.data);
    throw new Error(
      `${HIRE_ORCHESTRATOR_ERROR_CODES.userCreateFailed}: Spring responded ${outcome.status} without a usable user id (${detail})`
    );
  }

  const verifiedIds = await listUserIdsByEmail(normalizedEmail);
  if (!verifiedIds.includes(outcome.userId)) {
    throw new Error(
      `${HIRE_ORCHESTRATOR_ERROR_CODES.userVerifyFailed}: created user ${outcome.userId} is not visible by email (found: [${verifiedIds.join(",")}])`
    );
  }
  return { userId: outcome.userId, created: true };
}

/**
 * Resolves the Spring employee for an applicant email, creating it ONLY when
 * absent. Retries (after success) reuse; retries (after any failure) never
 * create a second user for the same email while one exists.
 * @param input - Applicant email + the Spring create payload + optional
 * request JWT override (production callers omit it; the request cookie is
 * read via `next/headers`).
 * @returns The resolved `user_id` and whether this run created it.
 * @throws Error with `HIRE_ORCHESTRATOR_ERROR_CODES` on lookup/create/verify
 * failures; the coded error is recorded by the orchestrator before rethrowing.
 */
export async function resolveHireUser(input: {
  email: string;
  payload: SpringUserCreatePayload;
  authToken?: string;
}): Promise<ResolvedHireUser> {
  const normalizedEmail = normalizeEmail(input.email);
  const quickHit = await findUserByEmail(normalizedEmail);
  if (quickHit !== null) return { userId: quickHit, created: false };

  const inFlight = inFlightByEmail.get(normalizedEmail);
  if (inFlight) {
    const shared = await inFlight;
    return { userId: shared.userId, created: false };
  }

  const token = input.authToken ?? (await readVosAccessToken());
  const task = createOrReuseUser(normalizedEmail, input.payload, token).finally(
    () => {
      inFlightByEmail.delete(normalizedEmail);
    }
  );
  inFlightByEmail.set(normalizedEmail, task);
  return task;
}
