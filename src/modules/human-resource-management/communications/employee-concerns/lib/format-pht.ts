const MONTHS = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const;

/**
 * Philippine Time (PHT / UTC+8) date formatter.
 * Uses manual offset to avoid browser timezone-database issues.
 * Safe to pass null, undefined, strings, or Date objects.
 */
export function formatPHT(
    date: Date | string | null | undefined,
    includeTime = true,
): string {
    if (!date) return "—";
    let d: Date;
    if (typeof date === "string") {
        // Directus returns MySQL datetime as ISO-without-timezone
        // (e.g. "2026-06-24T08:22:41"). JS parses such strings as LOCAL time,
        // which double-shifts the +8 offset below. Force UTC parsing by
        // appending "Z" when the string has no timezone marker.
        const s = date.trim();
        const hasTz = /[zZ]$|[+-]\d{2}:?\d{2}$/.test(s);
        d = new Date(hasTz ? s : s + "Z");
    } else {
        d = date;
    }
    if (isNaN(d.getTime())) return "—";

    // Shift to PHT (UTC+8)
    const utcMs = d.getTime();
    const phtMs = utcMs + 8 * 60 * 60 * 1000;
    const pht = new Date(phtMs);

    const day = pht.getUTCDate();
    const month = MONTHS[pht.getUTCMonth()];
    const year = pht.getUTCFullYear();

    if (!includeTime) return `${month} ${day}, ${year}`;

    let hours = pht.getUTCHours();
    const minutes = pht.getUTCMinutes().toString().padStart(2, "0");
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12 || 12;

    return `${month} ${day}, ${year} ${hours}:${minutes} ${ampm}`;
}
