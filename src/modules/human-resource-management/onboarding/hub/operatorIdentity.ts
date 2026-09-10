import {
  ONBOARDING_OWNER_ROLE,
  type OnboardingOwnerRole,
} from "@/modules/human-resource-management/onboarding/types/onboarding-task.schema";

import type { WorkspaceOperator } from "./taskInbox";

// operatorIdentity.ts — resolves the REAL operator for the HR onboarding hub
// (todo 29). Identity comes from the decoded `vos_access_token` payload only;
// there is no client role selector, so a viewer can never become another
// owner. When the platform issues one of the four onboarding owner roles in
// the `role` claim it is honoured; otherwise the HR hub's operator is HR
// (`hr`) — the surface's actual role. Every other owner (Department/Hiree/
// System) stays attributed as itself in the full task list and is never
// relabelled as HR, so this is attribution, not impersonation.

/** The subset of session claims this resolver reads. */
export interface OperatorClaims {
  sub?: unknown;
  role?: unknown;
}

const ONBOARDING_ROLE_SET = new Set<string>(ONBOARDING_OWNER_ROLE);

/**
 * @param claims - Decoded `vos_access_token` payload (or null when absent).
 * @returns The session operator: their real user id (when the claim parses to
 * a positive integer) and their owner role, defaulting to `hr` for the HR hub.
 */
export function resolveOnboardingOperator(
  claims: OperatorClaims | null
): WorkspaceOperator {
  const rawRole =
    typeof claims?.role === "string" ? claims.role.trim().toLowerCase() : "";
  const role: OnboardingOwnerRole = ONBOARDING_ROLE_SET.has(rawRole)
    ? (rawRole as OnboardingOwnerRole)
    : "hr";

  const parsedUserId = Number(claims?.sub);
  const userId =
    Number.isInteger(parsedUserId) && parsedUserId > 0 ? parsedUserId : null;

  return { userId, role };
}
