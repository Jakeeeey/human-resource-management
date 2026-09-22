// Mailing Studio — outbox provider (T5). Pure client wrapper over the real
// /api/hrm/mailing-studio/outbox routes (status-filtered list + single-row
// read). Rows arrive MASKED from the server (utils/ms-mask at the edge) —
// full recipient addresses never reach the client. READ-ONLY: there is no
// resend endpoint on this path on purpose (D17), so this file exposes no
// mutation. No tokens — auth travels via cookies.

import type { MsMaskedOutboxRow } from "../utils/ms-mask";
import { msGet } from "./msApi";

/**
 * Lists masked ms_outbox rows, newest first, via the real outbox route.
 * @param status - Optional status filter (queued|sent|failed|skipped|dry_run).
 * Unknown values are rejected by the route with a 400 (surfaced as Error).
 * @returns Masked rows (to_email is the j***@domain display form).
 */
export async function fetchMsOutbox(status?: string): Promise<MsMaskedOutboxRow[]> {
    const qs = status ? `?status=${encodeURIComponent(status)}` : "";
    const data = await msGet<MsMaskedOutboxRow[]>(`/outbox${qs}`);
    return data ?? [];
}

/**
 * Reads one masked ms_outbox row by id via the real by-id route.
 * @param id - Outbox row id.
 * @returns The masked row.
 * @throws Error when the route 404s (unknown id) or rejects.
 */
export async function fetchMsOutboxRow(id: string | number): Promise<MsMaskedOutboxRow> {
    const data = await msGet<MsMaskedOutboxRow>(`/outbox/${encodeURIComponent(String(id))}`);
    if (!data) throw new Error("Outbox entry not found.");
    return data;
}

export type { MsMaskedOutboxRow };
