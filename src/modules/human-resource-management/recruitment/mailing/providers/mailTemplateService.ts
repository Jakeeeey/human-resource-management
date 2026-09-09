// Fetch wrappers over the todos-5-7 template routes (mailing-module plan
// D16 layering: components → hooks → providers → routes; never Directus
// directly from the client). Thin passthroughs — no business logic here.

import type { MailTemplate } from "../types/mail-template.schema";

/** Client-side template row (Directus id + tinyint-boolean normalization). */
export interface MailTemplateRow extends MailTemplate {
    id: string | number;
}

/** Fields the UI collects; body_text is auto-generated at save. */
export interface MailTemplateInput {
    template_key: string;
    template_name: string;
    subject: string;
    body_html: string;
    body_text: string;
    is_active: boolean;
}

interface Envelope<T> {
    success: boolean;
    data?: T;
    message?: string;
    errors?: Record<string, string[]>;
}

/**
 * Normalizes a raw row (tinyint booleans read back as 1/0 per learnings).
 * @param row - Raw row from the route envelope.
 * @returns Row with is_active coerced to boolean.
 */
function normalizeRow(row: Record<string, unknown>): MailTemplateRow {
    const raw = row.is_active;
    return {
        ...(row as unknown as MailTemplate),
        id: (row.id as string | number) ?? "",
        is_active: raw === true || raw === 1 || raw === "1" || raw === "true",
    };
}

/**
 * Lists mail templates, newest first.
 * @returns Envelope with the normalized rows.
 */
export async function listMailTemplates(): Promise<Envelope<MailTemplateRow[]>> {
    const res = await fetch("/api/hrm/mailing/templates");
    const body = (await res.json()) as Envelope<Record<string, unknown>[]>;
    if (!body.success || !Array.isArray(body.data)) return { success: false, message: body.message ?? "Failed to list templates" };
    return { success: true, data: body.data.map(normalizeRow) };
}

/**
 * Creates a mail template (body_html must already be client-scrubbed).
 * @param input - Validated template fields incl. auto-generated body_text.
 * @returns Envelope with the created row.
 */
export async function createMailTemplate(input: MailTemplateInput): Promise<Envelope<MailTemplateRow>> {
    const res = await fetch("/api/hrm/mailing/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...input, updated_by: "" }),
    });
    const body = (await res.json()) as Envelope<Record<string, unknown>>;
    if (!body.success || !body.data) return { success: false, message: body.message ?? "Failed to create template", errors: body.errors };
    return { success: true, data: normalizeRow(body.data) };
}

/**
 * Updates a mail template by id (PATCH { id, ...fields }).
 * @param id - Template id.
 * @param patch - Partial fields to update.
 * @returns Envelope with the verified row.
 */
export async function updateMailTemplate(
    id: string | number,
    patch: Partial<MailTemplateInput>
): Promise<Envelope<MailTemplateRow>> {
    const res = await fetch("/api/hrm/mailing/templates", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...patch, updated_by: "" }),
    });
    const body = (await res.json()) as Envelope<Record<string, unknown>>;
    if (!body.success || !body.data) return { success: false, message: body.message ?? "Failed to update template", errors: body.errors };
    return { success: true, data: normalizeRow(body.data) };
}
