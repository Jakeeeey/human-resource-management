import type { UserRow } from "../salesman-qr-code/types";

export function fullName(u?: UserRow | null) {
  if (!u) return "—";
  const parts = [u.user_fname, u.user_mname, u.user_lname].filter(Boolean);
  const name = parts.join(" ").trim();
  return name || `User #${u.user_id}`;
}

export function isDeletedUser(u: UserRow) {
  // handle weird Buffer-like object
  const buf = u.is_deleted?.data;
  if (Array.isArray(buf) && buf.length) return buf[0] === 1;

  // fallback
  if (u.isDeleted === true) return true;

  return false;
}

export function ymd(d?: string | null) {
  if (!d) return "";
  // supports ISO-ish string
  return String(d).slice(0, 10);
}

export function contains(hay: string, needle: string) {
  return hay.toLowerCase().includes(needle.toLowerCase());
}
