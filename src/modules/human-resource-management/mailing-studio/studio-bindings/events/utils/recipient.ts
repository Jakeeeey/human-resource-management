// Mailing Studio — recipient resolution (P4-T1, D1). Reads the recipient
// email out of the emit payload at the binding's `recipient_path`.
// `recipient_path` is a JSONPath SUBSET only: `$.` + dot notation
// (`$.payload.to`). No filters, no wildcards, no bracket syntax — anything
// else resolves to "". `payload` is the only value root. Pure + server-safe
// (string ops only); never throws — unresolvable paths yield "" and the
// dispatcher converts that to a `skipped` row (§7.3 step 3).

/** Minimal binding shape needed for recipient resolution. */
export interface RecipientBinding {
    recipient_path?: unknown;
}

/** Default path used when a binding carries no (or a malformed) path. */
export const DEFAULT_RECIPIENT_PATH = "$.payload.to";

const PATH_SEGMENT_PATTERN = /^[A-Za-z0-9_]+$/;

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Resolves the recipient email from the payload via the binding path.
 * @param payload - The emit payload (the only value root).
 * @param binding - Binding carrying `recipient_path`.
 * @returns Trimmed email string, or "" when missing/unresolvable.
 */
export function resolveRecipient(
    payload: unknown,
    binding: RecipientBinding,
): string {
    try {
        const rawPath =
            typeof binding?.recipient_path === "string" &&
            binding.recipient_path.length > 0
                ? binding.recipient_path
                : DEFAULT_RECIPIENT_PATH;
        if (!rawPath.startsWith("$.")) return "";
        const segments = rawPath.slice(2).split(".");
        if (segments.length === 0) return "";
        for (const segment of segments) {
            if (segment.length === 0 || !PATH_SEGMENT_PATTERN.test(segment)) {
                return "";
            }
        }
        let current: unknown = { payload };
        for (const segment of segments) {
            if (!isRecord(current)) return "";
            if (!(segment in current)) return "";
            current = current[segment];
        }
        return typeof current === "string" ? current.trim() : "";
    } catch {
        return "";
    }
}
