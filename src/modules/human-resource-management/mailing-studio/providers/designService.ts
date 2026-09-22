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
 * @returns The envelope { data, message } — message carries export degradation
 * warnings (rotated/overlap/clipped) on saves; data is undefined when absent.
 * @throws Error on non-2xx, !success, or a non-JSON body.
 */
async function request<T>(
    path: string,
    init?: RequestInit,
): Promise<{ data: T | undefined; message: string | null }> {
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
    return { data: envelope.data, message: envelope.message ?? null };
}

/**
 * Saves a design (server upserts by template_key via design-persistence-service).
 * @param payload - Template meta + stringified design_json.
 * @returns The verified row plus the envelope message (export warnings, if any).
 * @throws Error when the route rejects or returns no data.
 */
export async function saveDesign(
    payload: DesignSavePayload,
): Promise<{ row: DesignRow; message: string | null }> {
    const { data: row, message } = await request<DesignRow>("", {
        method: "POST",
        body: JSON.stringify(payload),
    });
    if (!row) throw new Error("Design save returned no data");
    return { row, message };
}

/**
 * Fetches one design by template_key.
 * @param template_key - Unique ms_templates key.
 * @returns The row, or null when absent.
 */
export async function getDesign(template_key: string): Promise<DesignRow | null> {
    const { data: row } = await request<DesignRow | null>(
        `?template_key=${encodeURIComponent(template_key)}`
    );
    return row ?? null;
}

/**
 * Lists all designs, newest first.
 * @returns Row array (empty when the route returns no data).
 */
export async function listDesigns(): Promise<DesignRow[]> {
    const { data: rows } = await request<DesignRow[]>(``);
    return rows ?? [];
}

export interface PreviewResult {
    html: string;
    warnings: string[];
}

/**
 * Compiles the live (possibly unsaved) canvas doc through the real export
 * path without persisting anything.
 * @param design_json - Stringified canvas doc from the live store.
 * @param subject - Becomes the export document title.
 * @returns Compiled receiver HTML + export warnings.
 * @throws Error when the route rejects (e.g. empty canvas).
 */
export async function previewDesign(
    design_json: string,
    subject?: string,
): Promise<PreviewResult> {
    const res = await fetch("/api/hrm/mailing-studio/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ design_json, ...(subject ? { subject } : {}) }),
    });
    let envelope: { success: boolean; data?: PreviewResult; message?: string } | null =
        null;
    try {
        envelope = (await res.json()) as {
            success: boolean;
            data?: PreviewResult;
            message?: string;
        };
    } catch {
        envelope = null;
    }
    if (!res.ok || !envelope?.success || !envelope.data) {
        throw new Error(envelope?.message ?? `Preview request failed (HTTP ${res.status})`);
    }
    return envelope.data;
}
