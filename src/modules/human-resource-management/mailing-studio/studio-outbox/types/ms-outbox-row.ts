export interface MsOutboxRow {
    id: unknown;
    idempotency_key: unknown;
    to_email: string;
    template_id: unknown;
    event_key: unknown;
    status: unknown;
    warnings: string[];
    error: string | null;
    sent_at: unknown;
    attempts: number | null;
    next_attempt_at: string | null;
    rendered_subject: string | null;
    rendered_body_html: string | null;
}

function toWarnings(rawWarnings: unknown): string[] {
    if (Array.isArray(rawWarnings)) {
        return rawWarnings.map((entry) => String(entry));
    }
    if (typeof rawWarnings === "string" && rawWarnings.length > 0) {
        try {
            const parsed: unknown = JSON.parse(rawWarnings);
            return Array.isArray(parsed)
                ? parsed.map((entry) => String(entry))
                : [rawWarnings];
        } catch {
            return [rawWarnings];
        }
    }
    return [];
}

export function msToOutboxRow(row: Record<string, unknown>): MsOutboxRow {
    const rawError = row.error;
    const rawSubject = row.rendered_subject;
    const rawBody = row.rendered_body_html;
    const rawAttempts = row.attempts;
    const rawNextAttempt = row.next_attempt_at;
    const rawToEmail = row.to_email;
    return {
        id: row.id ?? null,
        idempotency_key: row.idempotency_key ?? null,
        to_email: typeof rawToEmail === "string" ? rawToEmail : "",
        template_id: row.template_id ?? null,
        event_key: row.event_key ?? null,
        status: row.status ?? null,
        warnings: toWarnings(row.warnings),
        error:
            rawError === null || rawError === undefined
                ? null
                : String(rawError),
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
