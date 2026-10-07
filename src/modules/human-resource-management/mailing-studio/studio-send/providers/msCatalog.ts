// Mailing Studio — read-only event-catalog provider. Lists event_catalog
// rows via the /studio-bindings/catalog collection route and unwraps the
// { success, data? } envelope via the shared msApi transport.

import type { MsCatalogRow } from "../types/ms-catalog.schema";
import { msGet } from "./msApi";

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
