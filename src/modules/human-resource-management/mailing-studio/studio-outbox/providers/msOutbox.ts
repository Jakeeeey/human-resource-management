import type { MsOutboxRow } from "../types/ms-outbox-row";
import { msGet } from "./msApi";

export const MS_OUTBOX_PAGE_SIZE = 10;

export interface MsOutboxQuery {
    status?: string;
    eventKey?: string;
    search?: string;
    sort?: string;
    page?: number;
    limit?: number;
}

export interface MsOutboxPage {
    rows: MsOutboxRow[];
    total: number;
    page: number;
    limit: number;
}

export async function fetchMsOutbox(query?: MsOutboxQuery): Promise<MsOutboxPage> {
    const params = new URLSearchParams();
    if (query?.status) params.set("status", query.status);
    if (query?.eventKey) params.set("event_key", query.eventKey);
    if (query?.search) params.set("search", query.search);
    if (query?.sort) params.set("sort", query.sort);
    if (query?.page !== undefined) params.set("page", String(query.page));
    if (query?.limit !== undefined) params.set("limit", String(query.limit));
    const qs = params.size > 0 ? `?${params.toString()}` : "";
    const data = await msGet<MsOutboxPage>(`/studio-outbox${qs}`);
    return (
        data ?? {
            rows: [],
            total: 0,
            page: query?.page ?? 1,
            limit: query?.limit ?? MS_OUTBOX_PAGE_SIZE,
        }
    );
}

export async function fetchMsOutboxRow(id: string | number): Promise<MsOutboxRow> {
    const data = await msGet<MsOutboxRow>(`/studio-outbox/${encodeURIComponent(String(id))}`);
    if (!data) throw new Error("Outbox entry not found.");
    return data;
}

export type { MsOutboxRow };
