// Fetch wrappers over the todo-6 bindings routes (mailing-module plan D16
// layering: components → hooks → providers → routes; never Directus
// directly from the client).

import type { MailEventKey } from "../types/mail-template.schema";
import type { MailSendCondition } from "../types/mail-binding.schema";

/** Client-side binding row. */
export interface MailBindingRow {
    id: string | number;
    event_key: MailEventKey;
    template_id: string | number;
    is_enabled: boolean;
    send_condition: MailSendCondition;
}

/** Fields for a new binding (never pre-filled with an enabled invite). */
export interface MailBindingInput {
    event_key: MailEventKey;
    template_id: string | number;
    is_enabled: boolean;
    send_condition: MailSendCondition;
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
 * @returns Row with is_enabled coerced to boolean.
 */
function normalizeRow(row: Record<string, unknown>): MailBindingRow {
    const raw = row.is_enabled;
    return {
        id: (row.id as string | number) ?? "",
        event_key: row.event_key as MailEventKey,
        template_id: (row.template_id as string | number) ?? "",
        is_enabled: raw === true || raw === 1 || raw === "1" || raw === "true",
        send_condition: row.send_condition as MailSendCondition,
    };
}

/**
 * Lists hook bindings.
 * @returns Envelope with the normalized rows.
 */
export async function listMailBindings(): Promise<Envelope<MailBindingRow[]>> {
    const res = await fetch("/api/hrm/mailing/bindings");
    const body = (await res.json()) as Envelope<Record<string, unknown>[]>;
    if (!body.success || !Array.isArray(body.data)) return { success: false, message: body.message ?? "Failed to list bindings" };
    return { success: true, data: body.data.map(normalizeRow) };
}

/**
 * Creates a hook binding.
 * @param input - Frozen-enum event_key + trio send_condition + flag.
 * @returns Envelope with the created row.
 */
export async function createMailBinding(input: MailBindingInput): Promise<Envelope<MailBindingRow>> {
    const res = await fetch("/api/hrm/mailing/bindings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
    });
    const body = (await res.json()) as Envelope<Record<string, unknown>>;
    if (!body.success || !body.data) return { success: false, message: body.message ?? "Failed to create binding", errors: body.errors };
    return { success: true, data: normalizeRow(body.data) };
}

/**
 * Patches a binding (toggle is_enabled or change condition/template).
 * @param id - Binding id.
 * @param patch - Partial fields to update.
 * @returns Envelope with the updated row.
 */
export async function updateMailBinding(
    id: string | number,
    patch: Partial<Omit<MailBindingInput, "event_key">> & Partial<Pick<MailBindingInput, "event_key">>
): Promise<Envelope<MailBindingRow>> {
    const res = await fetch("/api/hrm/mailing/bindings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...patch }),
    });
    const body = (await res.json()) as Envelope<Record<string, unknown>>;
    if (!body.success || !body.data) return { success: false, message: body.message ?? "Failed to update binding", errors: body.errors };
    return { success: true, data: normalizeRow(body.data) };
}

/**
 * Unhooks a binding (hard delete — always allowed).
 * @param id - Binding id.
 * @returns Success envelope.
 */
export async function deleteMailBinding(id: string | number): Promise<Envelope<{ id: string | number }>> {
    const res = await fetch(`/api/hrm/mailing/bindings?id=${encodeURIComponent(String(id))}`, { method: "DELETE" });
    const body = (await res.json()) as Envelope<{ id: string | number }>;
    if (!body.success) return { success: false, message: body.message ?? "Failed to unhook binding" };
    return { success: true, data: { id } };
}
