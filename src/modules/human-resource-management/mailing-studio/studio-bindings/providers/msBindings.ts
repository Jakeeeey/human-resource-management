import { msDelete, msGet, msPatch, msPost } from "./msApi";

export interface MsBindingRow {
    id: string | number;
    event_key_id: string | number;
    template_id: string | number;
    is_enabled: boolean | number | string;
}

export interface MsBindingCreate {
    event_key_id: string | number;
    template_id: string | number;
    is_enabled: boolean;
}

export interface MsBindingPatch {
    event_key_id?: string | number;
    template_id?: string | number;
    is_enabled?: boolean;
}

export async function fetchMsBindings(filters?: {
    event_key_id?: string | number;
    is_enabled?: boolean;
}): Promise<MsBindingRow[]> {
    const params = new URLSearchParams();
    if (filters?.event_key_id !== undefined && String(filters.event_key_id).length > 0)
        params.set("event_key_id", String(filters.event_key_id));
    if (filters?.is_enabled !== undefined)
        params.set("is_enabled", filters.is_enabled ? "true" : "false");
    const qs = params.size > 0 ? `?${params.toString()}` : "";
    const data = await msGet<MsBindingRow[]>(`/studio-bindings${qs}`);
    return data ?? [];
}

export async function createMsBinding(input: MsBindingCreate): Promise<MsBindingRow> {
    const data = await msPost<MsBindingRow>(`/studio-bindings`, input);
    if (!data) throw new Error("Failed to create binding.");
    return data;
}

export async function patchMsBinding(
    id: string | number,
    patch: MsBindingPatch,
): Promise<MsBindingRow> {
    const data = await msPatch<MsBindingRow>(
        `/studio-bindings/${encodeURIComponent(String(id))}`,
        patch,
    );
    if (!data) throw new Error("Binding not found.");
    return data;
}

export async function deleteMsBinding(id: string | number): Promise<void> {
    await msDelete(`/studio-bindings/${encodeURIComponent(String(id))}`);
}
