// Mailing Studio — templates provider (T5). Pure client wrapper over the
// real /api/hrm/mailing-studio/templates routes (list + single-row reads).
// Saves stay in providers/designService (saveDesign); this file only reads,
// so the tab list can render without touching the designer save path. No
// dFetch/Directus here (server-only) — auth travels via cookies, no tokens.

import type { DesignRow } from "./designService";
import { listDesigns } from "./designService";
import { msGet } from "./msApi";

/**
 * Lists ms_templates rows, newest first, via the real collection route.
 * @param isActive - Optional server-side filter (route ?is_active=).
 * @returns Row array (empty when the route returns no data).
 */
export async function fetchMsTemplates(isActive?: boolean): Promise<DesignRow[]> {
    const qs = isActive === undefined ? "" : `?is_active=${isActive ? "true" : "false"}`;
    const data = await msGet<DesignRow[]>(`/studio-templates${qs}`);
    return data ?? [];
}

/**
 * Reads one ms_templates row by numeric id or template_key via the real
 * by-id route.
 * @param id - Numeric row id or template_key.
 * @returns The row, or null when missing (route 404s → thrown as Error;
 * callers distinguishing absent rows should catch and treat as null).
 */
export async function fetchMsTemplate(id: string | number): Promise<DesignRow | null> {
    const data = await msGet<DesignRow>(`/studio-templates/${encodeURIComponent(String(id))}`);
    return data ?? null;
}

export type { DesignRow };
export { listDesigns };
