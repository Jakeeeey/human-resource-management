
const PH_OFFSET_MS = 8 * 60 * 60 * 1000;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;
const DASH = "—";

const HAS_ZONE = /(?:Z|[+-]\d{2}:?\d{2})$/i;
const DATE_TIME = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?$/i;

export function parseUtcInstant(value: string | Date | null | undefined): Date | null {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;

  const text = value.trim();
  if (!DATE_TIME.test(text)) return null;
  const iso = text.replace(" ", "T");
  const parsed = new Date(HAS_ZONE.test(iso) ? iso : `${iso}Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatPHT(value: string | Date | null | undefined, opts: { includeTime?: boolean } = {}): string {
  const instant = parseUtcInstant(value);
  if (!instant) return DASH;

  const ph = new Date(instant.getTime() + PH_OFFSET_MS);
  const date = `${MONTHS[ph.getUTCMonth()]} ${ph.getUTCDate()}, ${ph.getUTCFullYear()}`;
  if (opts.includeTime === false) return date;

  const hours = ph.getUTCHours();
  const minutes = String(ph.getUTCMinutes()).padStart(2, "0");
  return `${date} ${hours % 12 || 12}:${minutes} ${hours >= 12 ? "PM" : "AM"}`;
}

export function formatDateOnly(value: string | null | undefined): string {
  const match = typeof value === "string" ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim()) : null;
  if (!match) return DASH;
  const month = Number(match[2]);
  if (month < 1 || month > 12) return DASH;
  return `${MONTHS[month - 1]} ${Number(match[3])}, ${match[1]}`;
}

export function phLocalToUtcIso(local: string | null | undefined): string | null {
  if (typeof local !== "string") return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(local.trim());
  if (!match) return null;

  const [year, month, day, hour, minute] = match.slice(1, 6).map(Number);
  const second = match[6] === undefined ? 0 : Number(match[6]);
  const asUtc = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  if (
    asUtc.getUTCFullYear() !== year || asUtc.getUTCMonth() !== month - 1 || asUtc.getUTCDate() !== day ||
    asUtc.getUTCHours() !== hour || asUtc.getUTCMinutes() !== minute || asUtc.getUTCSeconds() !== second
  ) return null;

  return new Date(asUtc.getTime() - PH_OFFSET_MS).toISOString().replace(/\.\d{3}Z$/, "Z");
}

export function phToday(): string {
  return new Date(Date.now() + PH_OFFSET_MS).toISOString().slice(0, 10);
}
