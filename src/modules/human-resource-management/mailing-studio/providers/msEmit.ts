// Mailing Studio — emit helper (P3-T1, D7). The one-line module API:
//
//   await emit("leave.approved", { to, employee_name, days });
//
// Pure client wrapper over POST /api/hrm/mailing-studio/emit via the shared
// msApi transport. Envelope { success, data?, message? } mirrors
// providers/designService.ts. Everything else — which template fires, which
// variables fill, whether it is enabled — is studio configuration, so
// emitting a new event is a catalog row plus a binding row, never a code
// change. Server-side callers that already run in-process should import
// `emitEvent` from the emit route instead (bypasses HTTP, §7.6).

import { msPost } from "./msApi";

/** Emit outcome carried in the route's success envelope. */
export interface MsEmitResult {
    status: "sent" | "dry_run" | "queued" | "skipped" | "duplicate";
    outbox_id?: string | number;
}

/**
 * Fires a named mail event: the studio resolves the bindings for the key
 * and sends the templated email.
 * @param event_key - Catalog event key (e.g. "leave.approved").
 * @param payload - Arbitrary JSON object (must carry the recipient at `to` by default).
 * @param idempotency_key - Optional caller key (used verbatim; else derived per §7.2).
 * @returns The dispatch outcome ({ status, outbox_id? }).
 * @throws Error when the route rejects (unknown key, invalid payload, auth).
 */
export async function emit(
    event_key: string,
    payload: Record<string, unknown>,
    idempotency_key?: string,
): Promise<MsEmitResult> {
    const data = await msPost<MsEmitResult>(`/emit`, {
        event_key,
        payload,
        ...(idempotency_key !== undefined ? { idempotency_key } : {}),
    });
    if (!data) throw new Error("Emit returned no data.");
    return data;
}
