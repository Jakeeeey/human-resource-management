// portalAccess.ts — hiree-session access matrix (Todo 9, Metis G12).
// Pure gate shared by every portal route: the hiree session sees ONLY its
// own hire record; every HR hub action returns 403 here and vice versa.
//
// Contract:
// - Portal routes require `x-actor-role: hiree` + `x-hiree-profile-id: <id>`.
//   role=hr → 403 (HR hub actions never execute in the portal).
// - The target profile_id (query or body) must equal the session's own
//   profile id — cross-hire fetch → 403.
// - The reverse direction (hiree role calling HR hub routes) is rejected by
//   the hub (actor.role gate, Todo 7 precedent) — asserted in evidence,
//   never re-implemented here.

export interface HireeScope {
  role: string | null;
  sessionProfileId: number | null;
  targetProfileId: number | null;
}

export interface ScopeDecision {
  ok: boolean;
  status: number;
  message: string;
}

function toPositiveInt(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) return null;
  return value;
}

export function readHireeScope(
  headers: { get: (name: string) => string | null },
  targetProfileId: number | null
): HireeScope {
  return {
    role: headers.get("x-actor-role"),
    sessionProfileId: toPositiveInt(headers.get("x-hiree-profile-id")),
    targetProfileId,
  };
}

export function assertHireeScope(scope: HireeScope): ScopeDecision {
  if (scope.role === "hr") {
    return {
      ok: false,
      status: 403,
      message: "HR hub actions are not allowed in the hiree portal",
    };
  }
  if (scope.role !== "hiree") {
    return {
      ok: false,
      status: 403,
      message: "A hiree session is required to access the portal",
    };
  }
  if (scope.sessionProfileId === null) {
    return {
      ok: false,
      status: 403,
      message: "Hiree session is missing its own profile reference",
    };
  }
  if (scope.targetProfileId === null) {
    return {
      ok: false,
      status: 400,
      message: "A profile id is required",
    };
  }
  if (scope.targetProfileId !== scope.sessionProfileId) {
    return {
      ok: false,
      status: 403,
      message: "You can only access your own hire record",
    };
  }
  return { ok: true, status: 200, message: "Scoped to own hire record" };
}
