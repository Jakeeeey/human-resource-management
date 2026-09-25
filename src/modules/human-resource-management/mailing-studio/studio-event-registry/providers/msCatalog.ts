import type { MsCatalogRow, MsVariableRow } from "../types/ms-catalog.schema";
import { msDelete, msGet, msPatch, msPost } from "./msApi";

export interface MsCatalogCreate {
    event_key: string;
    label: string;
    description?: string | null;
    module?: string | null;
    variables: MsVariableRow[];
    is_active?: boolean;
}

export interface MsCatalogPatch {
    label?: string;
    description?: string | null;
    module?: string | null;
    variables?: MsVariableRow[];
    is_active?: boolean;
}

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

export async function createMsCatalog(input: MsCatalogCreate): Promise<MsCatalogRow> {
    const data = await msPost<MsCatalogRow>(`/studio-event-registry`, input);
    if (!data) throw new Error("Failed to register event key.");
    return data;
}

export async function patchMsCatalog(
    event_key: string,
    patch: MsCatalogPatch,
): Promise<MsCatalogRow> {
    const data = await msPatch<MsCatalogRow>(
        `/studio-event-registry/${encodeURIComponent(event_key)}`,
        patch,
    );
    if (!data) throw new Error("Event key not found.");
    return data;
}

export async function retireMsCatalog(event_key: string): Promise<void> {
    await msDelete(`/studio-event-registry/${encodeURIComponent(event_key)}`);
}
