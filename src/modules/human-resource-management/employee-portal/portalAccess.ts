import { z } from "zod";
import type { NextRequest } from "next/server";

import { dFetch } from "@/modules/human-resource-management/shared/utils/directus";
import { COOKIE_NAME, decodeJwtPayload } from "@/lib/auth-utils";

import type { PortalIdentity } from "./types/portal-checklist.schema";

// portalAccess.ts — server-side portal identity resolution (todo 25 re-key).
//
// The portal identity NO LONGER comes from `onboarding_profiles` and is NOT
// asserted by the client. The old `x-actor-role` / `x-hiree-profile-id`
// header gate is gone: every portal route resolves the caller's OWN hire
// record from the `vos_access_token` cookie payload.
//
// Phase model (one hire journey, two keys):
//   - PRE-HIRE  -> an `application.email` matches the session email; the
//     identity key is the applicant (`applicant.id`) — the same scope the
//     applicant signing desk uses (todo 13). No `user` row exists yet.
//   - POST-HIRE -> a `user` matches the session (`sub`/`user_id` claim, or
//     `user_email`); the identity key is the employee (`user_id`).
// A `user` match always wins: an existing employee is post-hire.
//
// REJECT MATRIX: no/undecodable token or no usable claim -> 401; a readable
// session with no matching user/application -> 404.
//
// KNOWN GAP (recorded, NOT fixed here — platform-wide scope): the JWT payload
// is decoded, not signature-verified, and no server-side role entitlement is
// enforced (same convention as every other `/api/hrm/*` proxy route). The
// client can no longer assert a foreign identity THROUGH THE PORTAL, but full
// session verification is the auth platform's job, not this module's.

export const PORTAL_IDENTITY_ERROR_CODES = {
  userReadFailed: "PORTAL_IDENTITY_USER_READ_FAILED",
  applicationReadFailed: "PORTAL_IDENTITY_APPLICATION_READ_FAILED",
} as const;

export type PortalIdentityResolution =
  | { ok: true; identity: PortalIdentity }
  | { ok: false; status: 401 | 404; message: string };

/** Reads the `vos_access_token` cookie from a portal request, or null. */
export function readPortalToken(req: NextRequest): string | null {
  return req.cookies.get(COOKIE_NAME)?.value ?? null;
}

/** Claim order: Spring/HRMS user id claims first, `sub` last (JWT standard). */
const USER_ID_CLAIMS = [
  "user_id",
  "employee_id",
  "EmployeeId",
  "employeeId",
  "id",
  "sub",
] as const;

function claimUserId(payload: Record<string, unknown>): number | null {
  for (const claim of USER_ID_CLAIMS) {
    const value = Number(payload[claim]);
    if (Number.isInteger(value) && value > 0) return value;
  }
  return null;
}

function claimEmail(payload: Record<string, unknown>): string | null {
  for (const claim of ["email", "Email"] as const) {
    const value = payload[claim];
    if (typeof value === "string" && value.trim()) {
      return value.trim().toLowerCase();
    }
  }
  return null;
}

const PortalUserRowSchema = z.object({
  user_id: z.number().int().positive(),
  user_email: z.string().nullable().optional(),
});

const PortalApplicationRowSchema = z.object({
  id: z.number().int().positive(),
  applicant_id: z.number().int().positive(),
  email: z.string().nullable().optional(),
});

type PortalUserRow = z.infer<typeof PortalUserRowSchema>;
type PortalApplicationRow = z.infer<typeof PortalApplicationRowSchema>;

function fail(code: string, detail: string): never {
  throw new Error(`${code}: ${detail}`);
}

function parseRows<T>(
  schema: z.ZodType<T>,
  body: unknown,
  code: string,
  label: string
): T[] {
  const envelope = z.object({ data: z.array(z.unknown()) }).safeParse(body);
  if (!envelope.success) {
    fail(code, `${label} read failed (${JSON.stringify(body).slice(0, 300)})`);
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

async function findUserById(userId: number): Promise<PortalUserRow | null> {
  const body: unknown = await dFetch(
    `/items/user?filter[user_id][_eq]=${userId}&fields=user_id,user_email&limit=1`
  );
  const rows = parseRows(
    PortalUserRowSchema,
    body,
    PORTAL_IDENTITY_ERROR_CODES.userReadFailed,
    `user ${userId}`
  );
  return rows[0] ?? null;
}

async function findUserByEmail(email: string): Promise<PortalUserRow | null> {
  const body: unknown = await dFetch(
    `/items/user?filter[user_email][_eq]=${encodeURIComponent(email)}&fields=user_id,user_email&sort=user_id&limit=1`
  );
  const rows = parseRows(
    PortalUserRowSchema,
    body,
    PORTAL_IDENTITY_ERROR_CODES.userReadFailed,
    `user email ${email}`
  );
  return rows[0] ?? null;
}

async function findApplicationByEmail(
  email: string
): Promise<PortalApplicationRow | null> {
  const body: unknown = await dFetch(
    `/items/application?filter[email][_eq]=${encodeURIComponent(email)}&fields=id,applicant_id,email&sort=-id&limit=1`
  );
  const rows = parseRows(
    PortalApplicationRowSchema,
    body,
    PORTAL_IDENTITY_ERROR_CODES.applicationReadFailed,
    `application email ${email}`
  );
  return rows[0] ?? null;
}

function employeeIdentity(
  userId: number,
  email: string | null
): PortalIdentity {
  return {
    kind: "employee",
    id: userId,
    phase: "post_hire",
    email,
    applicant_id: null,
    application_id: null,
    user_id: userId,
  };
}

function applicantIdentity(
  application: PortalApplicationRow,
  fallbackEmail: string
): PortalIdentity {
  return {
    kind: "applicant",
    id: application.applicant_id,
    phase: "pre_hire",
    email: application.email ?? fallbackEmail,
    applicant_id: application.applicant_id,
    application_id: application.id,
    user_id: null,
  };
}

/**
 * Resolves the caller's OWN portal identity server-side.
 * @param token - Raw `vos_access_token` cookie value (or null).
 * @returns `{ ok: true, identity }` for an applicant (pre-hire) or employee
 * (post-hire); `{ ok: false, status, message }` (401/404) otherwise.
 * @throws Coded `PORTAL_IDENTITY_*` errors when a Directus lookup fails —
 * the route maps that to 500, never to a false "no record".
 */
export async function resolvePortalIdentity(
  token: string | null
): Promise<PortalIdentityResolution> {
  if (!token) {
    return {
      ok: false,
      status: 401,
      message: "A hiree session is required to access the portal",
    };
  }

  const payload = decodeJwtPayload(token);
  if (!payload) {
    return {
      ok: false,
      status: 401,
      message: "The session is not a readable hire session",
    };
  }

  const userId = claimUserId(payload);
  const email = claimEmail(payload);
  if (userId === null && email === null) {
    return {
      ok: false,
      status: 401,
      message: "Session does not carry a hire reference",
    };
  }

  if (userId !== null) {
    const employee = await findUserById(userId);
    if (employee) {
      return {
        ok: true,
        identity: employeeIdentity(
          employee.user_id,
          employee.user_email ?? email
        ),
      };
    }
  }

  if (email !== null) {
    const employee = await findUserByEmail(email);
    if (employee) {
      return {
        ok: true,
        identity: employeeIdentity(
          employee.user_id,
          employee.user_email ?? email
        ),
      };
    }

    const application = await findApplicationByEmail(email);
    if (application) {
      return { ok: true, identity: applicantIdentity(application, email) };
    }
  }

  return {
    ok: false,
    status: 404,
    message: "No hire record found for this session",
  };
}
