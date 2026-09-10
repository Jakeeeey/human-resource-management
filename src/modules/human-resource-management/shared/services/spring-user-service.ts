// spring-user-service.ts — THE shared server-side caller of the Spring Boot
// employee-create endpoint (`POST /users/create`). Todo 16 extracted the
// proxy's upstream call into this module so BOTH callers reuse one path:
//
//   1. the manual-add proxy route
//      (`app/api/hrm/employee-admin/employee-master-list/create/route.ts`) —
//      forwards ANY payload body verbatim and proxies the upstream
//      status/body back to the browser;
//   2. the post-hire orchestrator
//      (`onboarding/hire/server/hire-orchestrator.ts`) — sends an
//      application-derived payload and consumes `userId` / `duplicateEmail`.
//
// Server-only: reads `SPRING_API_BASE_URL` at call time (never cached at
// module scope) and forwards the caller's `vos_access_token` as the Bearer
// token — the Spring JWT never crosses this boundary in the other direction.

/**
 * Employee-create payload shape consumed by Spring `/users/create`. The
 * password is mirrored into EVERY alias the manual form sends (Spring's DTO
 * binds them loosely; live-proven with the manual form's 8 aliases), and
 * `province`/`city`/`brgy` may be empty strings — Spring accepts empties.
 */
export interface SpringUserCreatePayload {
  email: string;
  hashPassword: string;
  userPassword: string;
  password: string;
  user_password: string;
  newPassword: string;
  plainPassword: string;
  rawPassword: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  nickname?: string;
  contact: string;
  province: string;
  city: string;
  brgy: string;
  position?: string;
  dateOfHire: string;
  role: string;
  admin: boolean;
  tags: string;
  birthday?: string;
  gender?: string;
  civilStatus?: string;
  religion?: string;
  sssNumber?: string;
  philHealthNumber?: string;
  tinNumber?: string;
  pagibigNumber?: string;
}

export interface SpringUserCreateOutcome {
  /** Upstream HTTP status; 500 with a local error body when not configured. */
  status: number;
  /** Parsed upstream body (empty object when the body is absent/unparsable). */
  data: unknown;
  /** `user.id` extracted from the known Spring response shapes, else null. */
  userId: number | null;
  /** True when Spring rejected the create because the email is taken. */
  duplicateEmail: boolean;
}

const NOT_CONFIGURED_MESSAGE = "Spring Boot API base not configured";

/**
 * Extracts the created employee id from the Spring response shapes this
 * codebase has observed (`{id}`, `{data:{id}}`, `{user:{id}}`,
 * `{user_id}`, `{data:{user_id}}`). Returns null for any other shape.
 * @param body - Parsed Spring response body.
 * @returns The numeric user id, or null when absent/unparseable.
 */
export function extractSpringUserId(body: unknown): number | null {
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return null;
  }
  const record = body as Record<string, unknown>;
  const nested = (key: string): Record<string, unknown> | null => {
    const value = record[key];
    return value !== null && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  };
  const raw =
    record["id"] ??
    record["user_id"] ??
    nested("data")?.["id"] ??
    nested("data")?.["user_id"] ??
    nested("user")?.["id"];
  const parsed =
    typeof raw === "number" ? raw : Number.parseInt(String(raw ?? ""), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

/**
 * Detects Spring's duplicate-email rejection. Live-proven shape: HTTP 400
 * with body `{"email":"Email is already registered!!!"}`. The text smell also
 * covers a duplicate surfaced with a different status.
 * @param status - Upstream HTTP status.
 * @param bodyText - Raw upstream body text.
 * @returns True when the failure is an already-registered email.
 */
function isDuplicateEmailRejection(status: number, bodyText: string): boolean {
  if (status !== 400 && status !== 409) return false;
  return /already registered|already exists|duplicate|has to be unique/i.test(
    bodyText
  );
}

/**
 * Calls Spring `POST /users/create` with the given payload.
 * Idempotency is NOT this function's job — it always issues the request; the
 * orchestrator owns lookup/dedupe before calling it.
 * @param payload - JSON body sent to Spring unchanged (manual form body or
 * the application-derived orchestrator payload).
 * @param authToken - `vos_access_token` JWT; omitted when unavailable.
 * @returns `{ status, data, userId, duplicateEmail }`; `status = 500` with a
 * local error body when `SPRING_API_BASE_URL` is not configured.
 */
export async function createSpringUser(
  payload: object,
  authToken?: string
): Promise<SpringUserCreateOutcome> {
  const springBase = process.env.SPRING_API_BASE_URL;
  if (!springBase) {
    return {
      status: 500,
      data: { error: NOT_CONFIGURED_MESSAGE },
      userId: null,
      duplicateEmail: false,
    };
  }

  const response = await fetch(
    `${springBase.replace(/\/+$/, "")}/users/create`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      },
      body: JSON.stringify(payload),
    }
  );

  const rawText = await response.text().catch(() => "");
  let data: unknown = {};
  try {
    data = rawText ? JSON.parse(rawText) : {};
  } catch {
    data = { error: rawText.slice(0, 500) };
  }

  return {
    status: response.status,
    data,
    userId: response.ok ? extractSpringUserId(data) : null,
    duplicateEmail: isDuplicateEmailRejection(response.status, rawText),
  };
}
