import type { JwtPayload } from "@/lib/auth-utils";

// audit.ts — manpower-request-owned actor-stamping helpers for app-level human attribution.
//
// Directus writes in this module go through `dFetch` with a static service
// token, so the acting human is never the Directus actor. Every server write
// path that accepts an `actorId` stamps it onto the row's `created_by` /
// `updated_by` INT columns via the helpers below and leaves every timestamp
// (`created_at` / `updated_at`) and every other key untouched.

/**
 * Derive the acting user id from a decoded JWT payload. Reads
 * `payload.id ?? payload.user_id ?? payload.sub` and coerces with `Number()`.
 * @param payload - Decoded JWT payload (or null when unauthenticated).
 * @returns The numeric actor id, or null when missing/uncoercible (NaN).
 */
export function actorIdFromJwt(
  payload: JwtPayload | null | undefined
): number | null {
  if (!payload) return null;
  const raw = payload.id ?? payload.user_id ?? payload.sub;
  if (raw === undefined || raw === null) return null;
  const id = Number(raw);
  return Number.isNaN(id) ? null : id;
}

/**
 * Stamp an INSERT payload with the actor. Null actor returns the row
 * unchanged; otherwise `updated_by` is set plus `created_by` unless
 * `opts.createdBy === false`.
 * @param row - The insert payload.
 * @param actorId - Acting user id (null = stamp nothing).
 * @param opts - Pass `{ createdBy: false }` to stamp only `updated_by`.
 * @returns The payload with the audit stamp applied.
 */
export function stampCreate<T extends Record<string, unknown>>(
  row: T,
  actorId: number | null,
  opts?: { createdBy?: boolean }
): T {
  if (actorId === null) return row;
  if (opts?.createdBy === false) return { ...row, updated_by: actorId };
  return { ...row, created_by: actorId, updated_by: actorId };
}

/**
 * Stamp a PATCH payload with the actor. Null actor returns the row unchanged.
 * @param row - The patch payload.
 * @param actorId - Acting user id (null = stamp nothing).
 * @returns The payload with `updated_by` applied.
 */
export function stampUpdate<T extends Record<string, unknown>>(
  row: T,
  actorId: number | null
): T {
  if (actorId === null) return row;
  return { ...row, updated_by: actorId };
}

/**
 * Current Philippine wall time as MySQL-compatible 'YYYY-MM-DD HH:mm:ss' (no offset).
 * Single producer for explicit audit timestamp writes — never rely on DB
 * CURRENT_TIMESTAMP / on-update, never toISOString (server clock is UTC).
 * @returns PH wall time string.
 */
export function nowPH(): string {
  return new Date().toLocaleString("sv-SE", { timeZone: "Asia/Manila" });
}
