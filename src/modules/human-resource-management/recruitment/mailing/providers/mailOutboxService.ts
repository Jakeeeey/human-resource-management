// Fetch wrappers over the todo-7 outbox routes (mailing-module plan D16
// layering: components → hooks → providers → routes). Read-only: the outbox
// has NO resend endpoint by design (D17). Rows arrive masked — the viewer
// must NOT unmask them.

import type { MailOutboxStatus } from "../types/mail-outbox.schema";

/** Viewer-safe outbox row (to_email already masked server-side). */
export interface MailOutboxRow {
    id: unknown;
    idempotency_key: unknown;
    to_email: string;
    template_id: unknown;
    event_key: unknown;
    status: unknown;
    warnings: string[];
    error: string | null;
    sent_at: unknown;
    rendered_subject: string | null;
    rendered_body_html: string | null;
}

interface Envelope<T> {
    success: boolean;
    data?: T;
    message?: string;
}

/**
 * Normalizes the warnings column (Directus JSON columns arrive as
 * JSON-encoded strings OR arrays — handle both per learnings).
 * @param value - Raw warnings value.
 * @returns String array.
 */
function normalizeWarnings(value: unknown): string[] {
    if (Array.isArray(value)) return value.map((entry) => String(entry));
    if (typeof value === "string" && value.length > 0) {
        try {
            const parsed: unknown = JSON.parse(value);
            if (Array.isArray(parsed)) return parsed.map((entry) => String(entry));
        } catch {
            return [value];
        }
    }
    return [];
}

/**
 * Normalizes a raw row to the viewer shape.
 * @param row - Raw row from the route envelope.
 * @returns Viewer-safe row.
 */
function normalizeRow(row: Record<string, unknown>): MailOutboxRow {
    const rawError = row.error;
    const rawSubject = row.rendered_subject;
    const rawBody = row.rendered_body_html;
    return {
        id: row.id ?? null,
        idempotency_key: row.idempotency_key ?? null,
        to_email: typeof row.to_email === "string" ? row.to_email : "***",
        template_id: row.template_id ?? null,
        event_key: row.event_key ?? null,
        status: row.status ?? null,
        warnings: normalizeWarnings(row.warnings),
        error: rawError === null || rawError === undefined ? null : String(rawError),
        sent_at: row.sent_at ?? null,
        rendered_subject: typeof rawSubject === "string" ? rawSubject : null,
        rendered_body_html: typeof rawBody === "string" ? rawBody : null,
    };
}

/**
 * Lists outbox rows, optionally filtered by status.
 * @param status - Optional status filter (invalid values 400 server-side).
 * @returns Envelope with the masked rows.
 */
export async function listMailOutbox(status?: MailOutboxStatus | ""): Promise<Envelope<MailOutboxRow[]>> {
    const qs = status ? `?status=${encodeURIComponent(status)}` : "";
    const res = await fetch(`/api/hrm/mailing/outbox${qs}`);
    const body = (await res.json()) as Envelope<Record<string, unknown>[]>;
    if (!body.success || !Array.isArray(body.data)) return { success: false, message: body.message ?? "Failed to list outbox" };
    return { success: true, data: body.data.map(normalizeRow) };
}
