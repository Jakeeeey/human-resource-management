import { z } from "zod";

import { dFetch } from "@/modules/human-resource-management/shared/utils/directus";
import {
  createSpringUser,
  type SpringUserCreatePayload,
} from "@/modules/human-resource-management/shared/services/spring-user-service";

import { HIRE_ORCHESTRATOR_ERROR_CODES } from "../types/hire.schema";
import { buildLoginEmail } from "./hire-email";

// hire-user.ts — idempotent Spring employee resolution for the post-hire
// orchestrator (todo 16).
//
// IDENTITY MODEL (task contract):
//   - The hire's IDENTITY is the applicant's PERSONAL email, held in
//     `user.personal_email` for new rows and still in `user.user_email` for
//     legacy rows (the personal address used to be the login). ONE `_or`
//     lookup matches either, so retries reuse the same user and two different
//     people who share a generated name never share an account.
//   - The account's login address is a GENERATED company address
//     (`first_last@companydomain`) and is NEVER used to key idempotency.
//   - IN-PROCESS MUTEX: concurrent orchestrations for the same identity
//     collapse onto ONE in-flight promise; only the run that performs the
//     create reports `created: true` (coalesced waiters report reuse).
//   - SUFFIX ALLOCATION: the login local part takes the SMALLEST FREE integer
//     suffix (base, then 2, 3, ...), checked against ALL users' `user_email`.
//   - DUPLICATE FALLBACK: on Spring's duplicateEmail, re-run the identity
//     lookup and reuse a concurrent winner; otherwise increment the suffix and
//     retry, bounded to 5 create attempts.
//   - READ-BACK VERIFY: after a create, read the user back by the GENERATED
//     `user_email`; if the row does not carry the personal email, persist it
//     with a Directus PATCH (Spring's DTO ignores unknown `personalEmail`).
// There is NO correlation column: the returned `user_id` is passed to the
// post-hire steps within the same orchestration run.

const UserIdListSchema = z.object({
  data: z.array(z.object({ user_id: z.number().int().positive() })),
});

const UserRowSchema = z.object({
  user_id: z.number().int().positive(),
  personal_email: z.string().nullable().optional(),
});

const MAX_CREATE_ATTEMPTS = 5;
const MAX_LOGIN_SUFFIX_SEARCH = 1000;

export interface ResolvedHireUser {
  userId: number;
  /** True when THIS resolution created the Spring user; false = reused. */
  created: boolean;
}

/** One in-flight resolution per hire identity (personal email). */
const inFlightByIdentity = new Map<string, Promise<ResolvedHireUser>>();

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

async function findUserIdByIdentity(
  normalizedPersonalEmail: string
): Promise<number | null> {
  const encoded = encodeURIComponent(normalizedPersonalEmail);
  const body: unknown = await dFetch(
    `/items/user?filter[_or][0][personal_email][_eq]=${encoded}&filter[_or][1][user_email][_eq]=${encoded}&fields=user_id&sort=user_id&limit=1`
  );
  const parsed = UserIdListSchema.safeParse(body);
  if (!parsed.success) {
    throw new Error(
      `${HIRE_ORCHESTRATOR_ERROR_CODES.readFailed}: user identity lookup failed (${JSON.stringify(body).slice(0, 300)})`
    );
  }
  return parsed.data.data[0]?.user_id ?? null;
}

async function findUserIdByUserEmail(email: string): Promise<number | null> {
  const body: unknown = await dFetch(
    `/items/user?filter[user_email][_eq]=${encodeURIComponent(email)}&fields=user_id&sort=user_id&limit=1`
  );
  const parsed = UserIdListSchema.safeParse(body);
  if (!parsed.success) {
    throw new Error(
      `${HIRE_ORCHESTRATOR_ERROR_CODES.readFailed}: user lookup for a login email failed (${JSON.stringify(body).slice(0, 300)})`
    );
  }
  return parsed.data.data[0]?.user_id ?? null;
}

async function readUserRowsByUserEmail(
  email: string
): Promise<Array<{ user_id: number; personal_email: string | null }>> {
  const body: unknown = await dFetch(
    `/items/user?filter[user_email][_eq]=${encodeURIComponent(email)}&fields=user_id,personal_email&sort=user_id&limit=50`
  );
  const parsed = z.object({ data: z.array(UserRowSchema) }).safeParse(body);
  if (!parsed.success) {
    throw new Error(
      `${HIRE_ORCHESTRATOR_ERROR_CODES.readFailed}: user read-back for a login email failed (${JSON.stringify(body).slice(0, 300)})`
    );
  }
  return parsed.data.data.map((row) => ({
    user_id: row.user_id,
    personal_email:
      typeof row.personal_email === "string" &&
      row.personal_email.trim().length > 0
        ? row.personal_email.trim()
        : null,
  }));
}

async function persistPersonalEmail(
  userId: number,
  personalEmail: string
): Promise<void> {
  const body: unknown = await dFetch(`/items/user/${userId}`, {
    method: "PATCH",
    body: JSON.stringify({ personal_email: personalEmail }),
  });
  const parsed = z
    .object({ data: z.object({ user_id: z.number().int().positive() }) })
    .safeParse(body);
  if (!parsed.success || parsed.data.data.user_id !== userId) {
    throw new Error(
      `${HIRE_ORCHESTRATOR_ERROR_CODES.userVerifyFailed}: personal_email for user ${userId} could not be persisted`
    );
  }
}

async function allocateLoginEmail(
  localPart: string,
  domain: string,
  startAt: number
): Promise<{ email: string; suffix: number }> {
  for (
    let suffix = startAt;
    suffix < startAt + MAX_LOGIN_SUFFIX_SEARCH;
    suffix += 1
  ) {
    const email = buildLoginEmail(
      localPart,
      domain,
      suffix === 1 ? undefined : String(suffix)
    );
    const takenBy = await findUserIdByUserEmail(email);
    if (takenBy === null) return { email, suffix };
  }
  throw new Error(
    `${HIRE_ORCHESTRATOR_ERROR_CODES.userCreateFailed}: no free login email for "${localPart}@${domain}"`
  );
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
  identity: string,
  personalEmail: string,
  localPart: string,
  domain: string,
  payload: SpringUserCreatePayload,
  authToken: string | undefined
): Promise<ResolvedHireUser> {
  const doubleChecked = await findUserIdByIdentity(identity);
  if (doubleChecked !== null) {
    return { userId: doubleChecked, created: false };
  }

  let allocation = await allocateLoginEmail(localPart, domain, 1);

  for (let attempt = 1; attempt <= MAX_CREATE_ATTEMPTS; attempt += 1) {
    const outcome = await createSpringUser(
      { ...payload, email: allocation.email },
      authToken
    );

    if (outcome.duplicateEmail) {
      const winner = await findUserIdByIdentity(identity);
      if (winner !== null) return { userId: winner, created: false };
      if (attempt === MAX_CREATE_ATTEMPTS) break;
      allocation = await allocateLoginEmail(
        localPart,
        domain,
        allocation.suffix + 1
      );
      continue;
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

    const rows = await readUserRowsByUserEmail(allocation.email);
    const createdRow = rows.find((row) => row.user_id === outcome.userId);
    if (!createdRow) {
      throw new Error(
        `${HIRE_ORCHESTRATOR_ERROR_CODES.userVerifyFailed}: created user ${outcome.userId} is not visible by email ${allocation.email} (found: [${rows.map((row) => row.user_id).join(",")}])`
      );
    }
    if (createdRow.personal_email === null) {
      await persistPersonalEmail(outcome.userId, personalEmail);
    }
    return { userId: outcome.userId, created: true };
  }

  throw new Error(
    `${HIRE_ORCHESTRATOR_ERROR_CODES.userCreateFailed}: Spring kept rejecting the generated login email for this hire after ${MAX_CREATE_ATTEMPTS} attempts`
  );
}

export async function resolveHireUser(input: {
  personalEmail: string;
  localPart: string;
  domain: string;
  payload: SpringUserCreatePayload;
  authToken?: string;
}): Promise<ResolvedHireUser> {
  const identity = normalizeEmail(input.personalEmail);
  const quickHit = await findUserIdByIdentity(identity);
  if (quickHit !== null) return { userId: quickHit, created: false };

  const inFlight = inFlightByIdentity.get(identity);
  if (inFlight) {
    const shared = await inFlight;
    return { userId: shared.userId, created: false };
  }

  const token = input.authToken ?? (await readVosAccessToken());
  const task = createOrReuseUser(
    identity,
    input.personalEmail.trim(),
    input.localPart,
    input.domain,
    input.payload,
    token
  ).finally(() => {
    inFlightByIdentity.delete(identity);
  });
  inFlightByIdentity.set(identity, task);
  return task;
}
