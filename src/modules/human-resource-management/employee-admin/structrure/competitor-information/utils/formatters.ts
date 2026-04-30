import type { SystemUser } from "../types";

export function formatDateTime(value?: string | null): string {
    if (!value) return "N/A";
    const date = parseLocalDate(value);
    if (Number.isNaN(date.getTime())) return "N/A";
    return date.toLocaleString();
}

export function parseLocalDate(value: string): Date {
    const trimmed = value.trim();
    const match = trimmed.match(
        /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?(?:\.(\d{1,3}))?)?(?:[zZ]|[+-]\d{2}:?\d{2})?$/
    );
    if (!match) return new Date(trimmed);

    const [, year, month, day, hour = "0", minute = "0", second = "0", ms = "0"] = match;
    return new Date(
        Number(year),
        Number(month) - 1,
        Number(day),
        Number(hour),
        Number(minute),
        Number(second),
        Number(ms.padEnd(3, "0"))
    );
}

export function toWebsiteHref(value?: string | null): string {
    if (!value) return "";
    const trimmed = value.trim();
    if (!trimmed) return "";
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    return `https://${trimmed}`;
}

export function formatCreatedBy(value?: SystemUser | string | number | null): string {
    if (!value) return "N/A";
    if (typeof value === "string" || typeof value === "number") return String(value);
    const name = [value.user_fname, value.user_mname, value.user_lname]
        .filter(Boolean)
        .join(" ");
    return name || value.user_email || "N/A";
}
