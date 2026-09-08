// Recipient masking for the mail outbox viewer (mailing-module Appendix —
// Recipient row: `to_email` is stored FULL in Directus; the viewer layer
// displays it masked as `j***@domain` (first char + `***` + `@domain`).
// Full addresses must never leave the server in ANY response field —
// including `warnings`/`error` echoes, which are scrubbed for email-like
// substrings too.
//
// Pure + server-safe (string ops only — no DOM). Never throws, never echoes
// its input on invalid data: invalid/missing input yields `"***"`.

const EMAIL_IN_TEXT_PATTERN =
    /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

/**
 * Masks a single email address for display: `juan@example.com` →
 * `j***@example.com`. Invalid/missing input returns `"***"`.
 * @param email - Raw stored address (expected string, tolerated unknown).
 * @returns Masked display form, or `"***"` when the input is unusable.
 */
export function maskMailAddress(email: unknown): string {
    if (typeof email !== "string") return "***";
    const trimmed = email.trim();
    const at = trimmed.lastIndexOf("@");
    if (at <= 0 || at >= trimmed.length - 1) return "***";
    const local = trimmed.slice(0, at);
    const domain = trimmed.slice(at + 1);
    if (!local || !domain) return "***";
    if (/\s/.test(local) || /\s/.test(domain)) return "***";
    return `${local[0]}***@${domain}`;
}

/**
 * Replaces every email-like substring in free text with its masked form.
 * Used for `warnings`/`error` echoes, which may quote the recipient
 * address (e.g. SMTP errors) — those echoes must not leak the full
 * local-part either.
 * @param value - Free-text string to scrub.
 * @returns Scrubbed string (input returned unchanged when it holds no address).
 */
export function maskEmailsInFreeText(value: string): string {
    if (typeof value !== "string" || value.length === 0) return value;
    return value.replace(
        EMAIL_IN_TEXT_PATTERN,
        (match) => maskMailAddress(match)
    );
}

/** Viewer-safe outbox row: `to_email` is ALWAYS the masked display form. */
export interface MaskedOutboxRow {
    id: unknown;
    idempotency_key: unknown;
    /** Display-masked recipient (`j***@domain`) — never the stored address. */
    to_email: string;
    template_id: unknown;
    event_key: unknown;
    status: unknown;
    warnings: string[];
    error: string | null;
    sent_at: unknown;
    /** Rendered snapshot subject (todo 21) — sender's own content, no addresses. */
    rendered_subject: string | null;
    /** Rendered snapshot body HTML (todo 21) — sender's own content, no addresses. */
    rendered_body_html: string | null;
}

/**
 * Projects a raw Directus `mail_outbox` row to its viewer-safe shape:
 * masks `to_email` and scrubs `warnings`/`error` echoes. `warnings`
 * arrives as either a JSON array or a JSON-encoded string (Directus JSON
 * column) — both normalize to `string[]`.
 * @param row - Raw Directus row object.
 * @returns Masked row safe to serialize to the client.
 */
export function toMaskedOutboxRow(
    row: Record<string, unknown>
): MaskedOutboxRow {
    const rawWarnings = row.warnings;
    let warnings: string[];
    if (Array.isArray(rawWarnings)) {
        warnings = rawWarnings.map((entry) =>
            maskEmailsInFreeText(String(entry))
        );
    } else if (typeof rawWarnings === "string" && rawWarnings.length > 0) {
        try {
            const parsed: unknown = JSON.parse(rawWarnings);
            warnings = Array.isArray(parsed)
                ? parsed.map((entry) => maskEmailsInFreeText(String(entry)))
                : [maskEmailsInFreeText(rawWarnings)];
        } catch {
            warnings = [maskEmailsInFreeText(rawWarnings)];
        }
    } else {
        warnings = [];
    }

    const rawError = row.error;
    const rawSubject = row.rendered_subject;
    const rawBody = row.rendered_body_html;
    return {
        id: row.id ?? null,
        idempotency_key: row.idempotency_key ?? null,
        to_email: maskMailAddress(row.to_email),
        template_id: row.template_id ?? null,
        event_key: row.event_key ?? null,
        status: row.status ?? null,
        warnings,
        error:
            rawError === null || rawError === undefined
                ? null
                : maskEmailsInFreeText(String(rawError)),
        sent_at: row.sent_at ?? null,
        rendered_subject: typeof rawSubject === "string" ? rawSubject : null,
        rendered_body_html: typeof rawBody === "string" ? rawBody : null,
    };
}
