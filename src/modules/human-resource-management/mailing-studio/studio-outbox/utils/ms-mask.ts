// Recipient masking for the mailing-studio outbox viewer — READ-ONLY copy of
// recruitment/mailing/utils/mailMask.ts (masked half only), exports renamed
// ms*/Ms* per the mailing-studio convention. `to_email` is stored FULL in
// Directus; the viewer layer displays it masked as `j***@domain` (first char +
// `***` + `@domain`). Full addresses must never leave the server in ANY
// response field — including `warnings`/`error` echoes, which are scrubbed for
// email-like substrings too.
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
export function msMaskMailAddress(email: unknown): string {
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
export function msMaskEmailsInFreeText(value: string): string {
    if (typeof value !== "string" || value.length === 0) return value;
    return value.replace(
        EMAIL_IN_TEXT_PATTERN,
        (match) => msMaskMailAddress(match)
    );
}

/** Viewer-safe outbox row: `to_email` is ALWAYS the masked display form. */
export interface MsMaskedOutboxRow {
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
    /** Relay attempt count (§7.6) — null when the column carries no grant. */
    attempts: number | null;
    /** Next scheduled attempt (PH wall-clock) — null when none is scheduled. */
    next_attempt_at: string | null;
    /** Rendered snapshot subject — sender's own content, no addresses. */
    rendered_subject: string | null;
    /** Rendered snapshot body HTML — sender's own content, no addresses. */
    rendered_body_html: string | null;
}

/**
 * Projects a raw Directus `ms_outbox` row to its viewer-safe shape:
 * masks `to_email` and scrubs `warnings`/`error` echoes. `warnings`
 * arrives as either a JSON array or a JSON-encoded string (Directus JSON
 * column) — both normalize to `string[]`.
 * @param row - Raw Directus row object.
 * @returns Masked row safe to serialize to the client.
 */
export function msToMaskedOutboxRow(
    row: Record<string, unknown>
): MsMaskedOutboxRow {
    const rawWarnings = row.warnings;
    let warnings: string[];
    if (Array.isArray(rawWarnings)) {
        warnings = rawWarnings.map((entry) =>
            msMaskEmailsInFreeText(String(entry))
        );
    } else if (typeof rawWarnings === "string" && rawWarnings.length > 0) {
        try {
            const parsed: unknown = JSON.parse(rawWarnings);
            warnings = Array.isArray(parsed)
                ? parsed.map((entry) => msMaskEmailsInFreeText(String(entry)))
                : [msMaskEmailsInFreeText(rawWarnings)];
        } catch {
            warnings = [msMaskEmailsInFreeText(rawWarnings)];
        }
    } else {
        warnings = [];
    }

    const rawError = row.error;
    const rawSubject = row.rendered_subject;
    const rawBody = row.rendered_body_html;
    const rawAttempts = row.attempts;
    const rawNextAttempt = row.next_attempt_at;
    return {
        id: row.id ?? null,
        idempotency_key: row.idempotency_key ?? null,
        to_email: msMaskMailAddress(row.to_email),
        template_id: row.template_id ?? null,
        event_key: row.event_key ?? null,
        status: row.status ?? null,
        warnings,
        error:
            rawError === null || rawError === undefined
                ? null
                : msMaskEmailsInFreeText(String(rawError)),
        sent_at: row.sent_at ?? null,
        attempts:
            typeof rawAttempts === "number" && Number.isInteger(rawAttempts) && rawAttempts >= 0
                ? rawAttempts
                : null,
        next_attempt_at:
            typeof rawNextAttempt === "string" && rawNextAttempt.length > 0
                ? rawNextAttempt
                : null,
        rendered_subject: typeof rawSubject === "string" ? rawSubject : null,
        rendered_body_html: typeof rawBody === "string" ? rawBody : null,
    };
}
