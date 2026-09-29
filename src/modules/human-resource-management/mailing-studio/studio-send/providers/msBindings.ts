import type { MsBindingRow } from "../types/ms-binding.schema";
import { msGet } from "./msApi";

export async function fetchMsBindings(): Promise<MsBindingRow[]> {
    const data = await msGet<MsBindingRow[]>(`/studio-bindings`);
    return data ?? [];
}

export type { MsBindingRow };
