// Mailing Studio — event-catalog provider (P2-T2). Pure client wrapper over
// the /api/hrm/mailing-studio/catalog routes (list/create/update/retire).
// Payloads are FLAT primitives only — both routes reject ANY object/array
// value (or unknown key) with a 400 before Zod, so payload_schema and
// payload_example travel as JSON STRINGS (parsed server-side); callers must
// never nest. Envelope { success, data?, message? } mirrors
// providers/designService.ts via the shared msApi transport. No tokens —
// auth travels via cookies.

import type { MsCatalogRow } from "../types/ms-catalog.schema";
import { msDelete, msGet, msPatch, msPost } from "./msApi";

/** Full-row payload for registering a new event key. */
export interface MsCatalogCreate {
    event_key: string;
    label: string;
    description?: string | null;
    module?: string | null;
    /** JSON string (object form is rejected by the route guard). */
    payload_schema?: string | null;
    /** JSON string (object form is rejected by the route guard). */
    payload_example?: string | null;
    is_active?: boolean;
}

/** Partial-row payload for updates (flat primitives only — never nested). */
export interface MsCatalogPatch {
    label?: string;
    description?: string | null;
    module?: string | null;
    /** JSON string (object form is rejected by the route guard). */
    payload_schema?: string | null;
    /** JSON string (object form is rejected by the route guard). */
    payload_example?: string | null;
    is_active?: boolean;
}

/**
 * Lists event_catalog rows via the real collection route.
 * @param filters - Optional active-state filter (unknown values → route 400).
 * @returns Catalog rows ordered by event_key.
 */
export async function fetchMsCatalog(filters?: {
    is_active?: boolean;
}): Promise<MsCatalogRow[]> {
    const params = new URLSearchParams();
    if (filters?.is_active !== undefined)
        params.set("is_active", filters.is_active ? "true" : "false");
    const qs = params.size > 0 ? `?${params.toString()}` : "";
    const data = await msGet<MsCatalogRow[]>(`/studio-bindings/catalog${qs}`);
    return data ?? [];
}

/**
 * Registers a new event key via the real collection route.
 * @param input - Flat full-row payload (event_key + label required).
 * @returns The verified row.
 */
export async function createMsCatalog(input: MsCatalogCreate): Promise<MsCatalogRow> {
    const data = await msPost<MsCatalogRow>(`/studio-bindings/catalog`, input);
    if (!data) throw new Error("Failed to register event key.");
    return data;
}

/**
 * Updates a catalog row via the real by-key route (PATCH is_active:false is
 * the soft retire — the row survives, inactive).
 * @param event_key - Catalog key.
 * @param patch - Flat partial payload (at least one field).
 * @returns The verified row.
 */
export async function patchMsCatalog(
    event_key: string,
    patch: MsCatalogPatch,
): Promise<MsCatalogRow> {
    const data = await msPatch<MsCatalogRow>(
        `/studio-bindings/catalog/${encodeURIComponent(event_key)}`,
        patch,
    );
    if (!data) throw new Error("Event key not found.");
    return data;
}

/**
 * Soft-retires an event key via the real by-key route (is_active=false —
 * bindings for the key stop validating, the row survives).
 * @param event_key - Catalog key.
 */
export async function retireMsCatalog(event_key: string): Promise<void> {
    await msDelete(`/studio-bindings/catalog/${encodeURIComponent(event_key)}`);
}
