// Client contract for the (not-yet-existing) T4 routes under
// /api/hrm/mailing-studio/templates. Envelope mirrors the old
// src/app/api/hrm/mailing/templates/route.ts pattern (read-only reference):
//   { success: boolean, data?: T, message?: string }
// Verb contract (T4 handlers delegate straight to
// services/design-persistence-service.ts):
//   POST ""                       → save (create-or-PATCH by template_key)
//   GET  ?template_key=...        → single row (null data when absent)
//   GET  (no params)              → list, newest first
// Pure client — no dFetch/Directus here (that lives server-side in
// services/design-persistence-service.ts). Until T4 ships, these calls 404 and
// useDesignAutosave surfaces status "error". Never touches mail_outbox.

export interface DesignSavePayload {
    template_key: string;
    template_name: string;
    subject: string;
    design_json: string;
    body_html?: string | null;
    body_text?: string | null;
    is_active?: boolean;
}

export interface DesignRow {
    id?: number | string;
    template_key: string;
    template_name: string;
    subject: string;
    design_json?: string | null;
    body_html?: string | null;
    body_text?: string | null;
    is_active?: boolean | number;
    created_at?: string | null;
    updated_at?: string | null;
}

interface DesignEnvelope<T> {
    success: boolean;
    data?: T;
    message?: string;
}

const BASE = "/api/hrm/mailing-studio/templates";

/**
 * Fetches a T4 design route and unwraps the { success, data?, message? } envelope.
 * @param path - Path appended to BASE ("" or "?template_key=...").
 * @param init - Optional RequestInit (method/body/headers).
 * @returns envelope.data, or undefined when the envelope carries no data.
 * @throws Error on non-2xx, !success, or a non-JSON body.
 */
async function request<T>(path: string, init?: RequestInit): Promise<T | undefined> {
    const res = await fetch(`${BASE}${path}`, {
        ...init,
        headers: {
            "Content-Type": "application/json",
            ...(init?.headers ?? {}),
        },
    });
    let envelope: DesignEnvelope<T> | null = null;
    try {
        envelope = (await res.json()) as DesignEnvelope<T>;
    } catch {
        envelope = null;
    }
    if (!res.ok || !envelope?.success) {
        throw new Error(envelope?.message ?? `Design request failed (HTTP ${res.status})`);
    }
    return envelope.data;
}

/**
 * Saves a design (server upserts by template_key via design-persistence-service).
 * @param payload - Template meta + stringified design_json.
 * @returns The verified row from the route.
 * @throws Error when the route rejects or returns no data.
 */
export async function saveDesign(payload: DesignSavePayload): Promise<DesignRow> {
    const row = await request<DesignRow>("", {
        method: "POST",
        body: JSON.stringify(payload),
    });
    if (!row) throw new Error("Design save returned no data");
    return row;
}

/**
 * Fetches one design by template_key.
 * @param template_key - Unique ms_templates key.
 * @returns The row, or null when absent.
 */
export async function getDesign(template_key: string): Promise<DesignRow | null> {
    const row = await request<DesignRow | null>(
        `?template_key=${encodeURIComponent(template_key)}`
    );
    return row ?? null;
}

/**
 * Lists all designs, newest first.
 * @returns Row array (empty when the route returns no data).
 */
export async function listDesigns(): Promise<DesignRow[]> {
    const rows = await request<DesignRow[]>(``);
    return rows ?? [];
}
