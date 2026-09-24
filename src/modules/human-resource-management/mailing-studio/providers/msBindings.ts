// Mailing Studio — bindings provider (T5). Pure client wrapper over the
// real /api/hrm/mailing-studio/bindings routes (list/create/update/delete).
// Payloads are FLAT primitives only — both routes reject ANY object/array
// value (or unknown key) with a 400 before Zod, so callers must never nest.
// event_key is catalog-driven (D4) — any active event_catalog key binds;
// send_condition stays always|on_pass|on_fail.
// No tokens — auth travels via cookies.

import { msDelete, msGet, msPatch, msPost } from "./msApi";

/** ms_bindings row as returned by the routes (is_enabled may arrive 1/0). */
export interface MsBindingRow {
    id: string | number;
    event_key: string;
    template_id: string | number;
    is_enabled: boolean | number | string;
    send_condition: string;
    /** §6.2 — present once the Phase-1 DDL lands; absent rows use the UI default. */
    recipient_path?: unknown;
    /** §6.2 — present once the Phase-1 DDL lands; absent rows use the UI default. */
    priority?: unknown;
}

/** Full-row payload for hooking a new binding. */
export interface MsBindingCreate {
    event_key: string;
    template_id: string | number;
    is_enabled: boolean;
    send_condition: string;
    recipient_path?: string;
    priority?: number;
}

/** Partial-row payload for updates (flat primitives only — never nested). */
export interface MsBindingPatch {
    event_key?: string;
    template_id?: string | number;
    is_enabled?: boolean;
    send_condition?: string;
    recipient_path?: string;
    priority?: number;
}

/**
 * Lists ms_bindings rows via the real collection route.
 * @param filters - Optional validated filters (unknown values → route 400).
 * @returns Binding rows ordered by id.
 */
export async function fetchMsBindings(filters?: {
    event_key?: string;
    send_condition?: string;
    is_enabled?: boolean;
}): Promise<MsBindingRow[]> {
    const params = new URLSearchParams();
    if (filters?.event_key) params.set("event_key", filters.event_key);
    if (filters?.send_condition) params.set("send_condition", filters.send_condition);
    if (filters?.is_enabled !== undefined)
        params.set("is_enabled", filters.is_enabled ? "true" : "false");
    const qs = params.size > 0 ? `?${params.toString()}` : "";
    const data = await msGet<MsBindingRow[]>(`/bindings${qs}`);
    return data ?? [];
}

/**
 * Hooks a new binding via the real collection route (full row required).
 * @param input - Flat full-row payload.
 * @returns The created row.
 */
export async function createMsBinding(input: MsBindingCreate): Promise<MsBindingRow> {
    const data = await msPost<MsBindingRow>(`/bindings`, input);
    if (!data) throw new Error("Failed to create binding.");
    return data;
}

/**
 * Updates a binding via the real by-id route (PATCH is_enabled:false is the
 * soft unhook — the row survives, disabled).
 * @param id - Binding id.
 * @param patch - Flat partial payload (at least one field).
 * @returns The updated row.
 */
export async function patchMsBinding(
    id: string | number,
    patch: MsBindingPatch,
): Promise<MsBindingRow> {
    const data = await msPatch<MsBindingRow>(
        `/bindings/${encodeURIComponent(String(id))}`,
        patch,
    );
    if (!data) throw new Error("Binding not found.");
    return data;
}

/**
 * Hard-deletes a binding via the real by-id route (unhook = gone).
 * @param id - Binding id.
 */
export async function deleteMsBinding(id: string | number): Promise<void> {
    await msDelete(`/bindings/${encodeURIComponent(String(id))}`);
}
