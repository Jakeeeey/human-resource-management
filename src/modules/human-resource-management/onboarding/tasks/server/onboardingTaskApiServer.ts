import type { NextRequest } from "next/server";

import type { JwtPayload } from "@/lib/auth-utils";
import { readSigningSession } from "../../signing/server/signingApiServer";

// onboardingTaskApiServer.ts — boundary helpers for the employee-keyed task
// API (todo 19). The generic session/response helpers are the todo-9 signing
// boundary (same `vos_access_token` cookie, same `{success,message}` error
// envelope) re-exported under this feature's name — one auth convention for
// every new onboarding route, no duplicated implementations.

export {
  notFound,
  serverError,
  unauthorized,
  validationFailed,
} from "../../signing/server/signingApiServer";

export function readOnboardingTaskSession(
  req: NextRequest
): JwtPayload | null {
  return readSigningSession(req);
}

/**
 * @param session - Decoded session payload.
 * @returns `session.sub` as a positive integer, else null — the session user
 * id written to `created_by` / `updated_by` / `completed_by` (attribution).
 */
export function sessionActorId(session: JwtPayload): number | null {
  const parsed = Number(session.sub);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}
