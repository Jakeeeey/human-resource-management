import { logRedacted } from "@/modules/human-resource-management/recruitment/mailing/utils/mailLog";

// ensureOnboardingProfile.ts — server-only (route-folder co-located lib).
//
// Idempotent onboarding-profile ensure-call for the Master List hire hook.
// NEVER throws to the caller: every path — including all failures — resolves
// to `{ ok, reason? }`, mirroring the `dispatchMail` never-throw contract.
// The hire POST must never fail or slow down because of onboarding.
//
// Upsert strategy against the UNIQUE `onboarding_profiles.employee_id` key
// (asserted `is_unique: true` in task-1a evidence): pre-check GET first, then
// POST; a failed POST whose body smells like a uniqueness conflict is
// swallowed as a duplicate (covers the concurrent double-POST race where
// both writers pass the pre-check before either inserts).
//
// Server-side only — reads DIRECTUS_STATIC_TOKEN at call time (never cached
// at module scope, so rotation applies without redeploy) and never exposes
// it to the browser. Token referenced by NAME only in logs/evidence.

export interface EnsureOnboardingProfileResult {
  ok: boolean;
  reason?: string;
}

/**
 * PH-time producer (conventions.md §6 equivalent — mirrors the
 * `getPhilippineTime` producer in dispatchMail): MySQL-compatible
 * 'YYYY-MM-DD HH:mm:ss' wall time. Never server default / UTC toISOString.
 * @returns Current Philippine time as a MySQL-compatible string.
 */
function getPhilippineTime(): string {
  return new Date().toLocaleString("sv-SE", { timeZone: "Asia/Manila" });
}

/**
 * Detects a uniqueness-conflict failure body (Directus answers UNIQUE
 * violations with HTTP 400 + a RECORD_NOT_UNIQUE "has to be unique" error,
 * not 409 — match the body, not just the status).
 * @param status - Upstream HTTP status of the failed insert.
 * @param bodyText - Raw response body text of the failed insert.
 * @returns True when the failure is a duplicate another writer won.
 */
function isDuplicateConflict(status: number, bodyText: string): boolean {
  if (status === 409) return true;
  return /record_not_unique|has to be unique|must be unique|\bduplicate\b|already exists/i.test(
    bodyText
  );
}

/**
 * Ensures exactly one `onboarding_profiles` row exists for an employee.
 * Initial row honors the task-1a contract: `employee_id` (the upsert key),
 * `status` (hire enters as FOR_ONBOARDING), `offer_accepted: false` (HR
 * confirms acceptance later in the hub); `application_id` is left null and
 * never spoofed — HR links it manually when the hire carries no bridge.
 * @param employeeId - Spring employee id (the UNIQUE upsert key).
 * @returns `{ ok: true }` when the row exists (pre-existing, inserted, or
 * duplicate-collapsed); `{ ok: false, reason }` otherwise. Never throws.
 */
export async function ensureOnboardingProfile(
  employeeId: number
): Promise<EnsureOnboardingProfileResult> {
  try {
    if (!Number.isInteger(employeeId) || employeeId <= 0) {
      return { ok: false, reason: "invalid-args" };
    }

    // Read env INSIDE the call so credentials stay fresh (upload-route pattern).
    const DIRECTUS_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
    const TOKEN = process.env.DIRECTUS_STATIC_TOKEN;
    if (!DIRECTUS_URL || !TOKEN) {
      return { ok: false, reason: "not-configured" };
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: "Bearer " + TOKEN,
    };

    // Pre-check: a row for this employee already satisfies the ensure.
    try {
      const existing = await fetch(
        DIRECTUS_URL +
          "/items/onboarding_profiles?filter[employee_id][_eq]=" +
          employeeId +
          "&fields=id&limit=1",
        { headers }
      );
      if (existing.ok) {
        const found = (await existing.json().catch(() => null)) as {
          data?: unknown;
        } | null;
        if (Array.isArray(found?.data) && found.data.length > 0) {
          return { ok: true };
        }
      }
    } catch (error) {
      logRedacted("[ensureOnboardingProfile] pre-check failed:", error);
      return { ok: false, reason: "precheck-failed" };
    }

    const now = getPhilippineTime();
    const insert = await fetch(DIRECTUS_URL + "/items/onboarding_profiles", {
      method: "POST",
      headers,
      body: JSON.stringify({
        employee_id: employeeId,
        status: "FOR_ONBOARDING",
        offer_accepted: false,
        created_at: now,
        updated_at: now,
      }),
    });

    if (insert.ok) {
      return { ok: true };
    }

    const bodyText = await insert.text().catch(() => "");
    if (isDuplicateConflict(insert.status, bodyText)) {
      // Concurrent double-POST collapsed to one row — the other writer won.
      return { ok: true, reason: "duplicate" };
    }

    logRedacted("[ensureOnboardingProfile] insert failed:", {
      status: insert.status,
    });
    return { ok: false, reason: "insert-failed" };
  } catch (error) {
    logRedacted(
      "[ensureOnboardingProfile] unexpected failure (never throw):",
      error
    );
    return { ok: false, reason: "internal-error" };
  }
}
