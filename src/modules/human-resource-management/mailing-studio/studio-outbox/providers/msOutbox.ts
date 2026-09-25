// Mailing Studio — outbox provider (T5). Pure client wrapper over the real
// /api/hrm/mailing-studio/outbox routes (status-filtered list + single-row
// read). Rows arrive MASKED from the server (utils/ms-mask at the edge) —
// full recipient addresses never reach the client. READ-ONLY: there is no
// resend endpoint on this path on purpose (D17), so this file exposes no
// mutation. No tokens — auth travels via cookies.

import type { MsMaskedOutboxRow } from "../utils/ms-mask";
import { msGet } from "./msApi";

/** Studio outbox list page size (QA §11 default). */
export const MS_OUTBOX_PAGE_SIZE = 10;

/** List query — every field optional; the route applies its own defaults. */
export interface MsOutboxQuery {
    status?: string;
    eventKey?: string;
    search?: string;
    sort?: string;
    page?: number;
    limit?: number;
}

/** One server-paged list answer (rows carry masked recipients). */
export interface MsOutboxPage {
    rows: MsMaskedOutboxRow[];
    total: number;
    page: number;
    limit: number;
}

/**
 * Lists masked ms_outbox rows, newest first, via the real outbox route.
 * The route pages server-side (default 10, QA §11), filters by status and
 * event key, searches recipient/event/key substrings, and sorts by an
 * allowlisted column — the list payload never ships `rendered_body_html`
 * (fetched per-row via fetchMsOutboxRow on select).
 * @param query - Optional status/eventKey/search/sort/page/limit.
 * Unknown status values are rejected by the route with a 400 (surfaced as
 * Error).
 * @returns Masked page ({ rows, total, page, limit }).
 */
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

/**
 * Reads one masked ms_outbox row by id via the real by-id route.
 * @param id - Outbox row id.
 * @returns The masked row.
 * @throws Error when the route 404s (unknown id) or rejects.
 */
export async function fetchMsOutboxRow(id: string | number): Promise<MsMaskedOutboxRow> {
    const data = await msGet<MsMaskedOutboxRow>(`/studio-outbox/${encodeURIComponent(String(id))}`);
    if (!data) throw new Error("Outbox entry not found.");
    return data;
}

export type { MsMaskedOutboxRow };
