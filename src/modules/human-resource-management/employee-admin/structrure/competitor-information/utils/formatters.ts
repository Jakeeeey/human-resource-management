import type { SystemUser } from "../types";

export function formatDateTime(value?: string | null): string {
    if (!value) return "N/A";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "N/A";
    return date.toLocaleString();
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
