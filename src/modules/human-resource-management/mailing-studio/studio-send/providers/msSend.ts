// Mailing Studio — send provider (T5). Pure client wrapper over the real
// manual-send / send-now / applicant-email routes. Every call records exactly
// ONE ms_outbox row server-side (sent | dry_run | skipped | failed) and the
// response carries only { ok, reason?, status } outcome fields — never PII.
// No tokens — auth travels via cookies.

import { msGet, msPost } from "./msApi";

/** Outcome envelope shared by manual-send and send-now (never PII). */
export interface MsSendOutcome {
    ok: boolean;
    reason?: string;
    status?: string;
    idempotency_key?: string;
    customized?: boolean;
}

/** STRICT manual-send body: single recipient + send-only overrides. */
export interface MsManualSendInput {
    template_id: string | number;
    to_email: string;
    subject?: string;
    body_html?: string;
}

/** STRICT send-now body: exactly one of event_key / binding_id + recipient. */
export interface MsSendNowInput {
    to_email: string;
    event_key?: string;
    binding_id?: string | number;
}

/**
 * Sends one template to one recipient via the real manual-send route.
 * subject/body_html overrides are send-only (never persisted to the
 * template); the final HTML is re-asserted server-side.
 * @param input - Template + single recipient (+ optional overrides).
 * @returns Outcome ({ ok, reason?, status }) — never PII.
 */
export async function postManualSend(input: MsManualSendInput): Promise<MsSendOutcome> {
    const data = await msPost<MsSendOutcome>(`/studio-send/manual-send`, input);
    if (!data) throw new Error("Manual send returned no outcome.");
    return data;
}

/**
 * Dispatches one binding-triggered send via the real send-now route.
 * @param input - Exactly one of event_key / binding_id plus the recipient.
 * @returns Outcome ({ ok, reason? }) — never PII.
 */
export async function postSendNow(input: MsSendNowInput): Promise<MsSendOutcome> {
    const data = await msPost<MsSendOutcome>(`/studio-send/send-now`, input);
    if (!data) throw new Error("Send-now returned no outcome.");
    return data;
}

/**
 * Resolves one applicant record email for compose autofill via the real
 * applicant-email route. Unknown id or invalid email → null (never a list).
 * @param applicationId - Application record id.
 * @returns The single resolved address, or null.
 */
export async function fetchApplicantEmail(applicationId: string): Promise<string | null> {
    const data = await msGet<{ email: string | null }>(
        `/studio-send/applicant-email?application_id=${encodeURIComponent(applicationId)}`,
    );
    return data?.email ?? null;
}
