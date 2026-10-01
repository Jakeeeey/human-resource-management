import type { JwtPayload } from "@/lib/auth-utils";


export function actorIdFromJwt(
  payload: JwtPayload | null | undefined
): number | null {
  if (!payload) return null;
  const raw = payload.id ?? payload.user_id ?? payload.sub;
  if (raw === undefined || raw === null) return null;
  const id = Number(raw);
  return Number.isNaN(id) ? null : id;
}

export function stampCreate<T extends Record<string, unknown>>(
  row: T,
  actorId: number | null
): T {
  if (actorId === null) return row;
  return { ...row, created_by: actorId };
}

export function stampUpdate<T extends Record<string, unknown>>(
  row: T,
  actorId: number | null
): T {
  if (actorId === null) return row;
  return { ...row, updated_by: actorId };
}

export function nowPH(): string {
  return new Date().toLocaleString("sv-SE", { timeZone: "Asia/Manila" });
}

export function nowUTC(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}

export function creationTimestamps(now: string = nowUTC()): { created_at: string; updated_at: null } {
  return { created_at: now, updated_at: null };
}
