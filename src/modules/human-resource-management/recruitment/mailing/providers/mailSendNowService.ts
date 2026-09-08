// Fetch wrappers for the manual Send-now path (mailing-module todo 12,
// D16 layering: components → hooks → providers → routes; never Directus
// directly from the client).
//
// The applicant list is READ-ONLY here: it reuses the existing
// `/api/hrm/applicants` shape (`{ id, full_name, position_applied_for,
// application_id, ... }` — the job-offer module's mapping is the precedent)
// without modifying that route. Only applicants WITH an application_id are
// sendable (dispatch needs an application_id for its manual key).

/** Sendable applicant pick: who + which application + where the mail goes. */
export interface SendNowApplicant {
    applicant_id: number;
    full_name: string;
    position_applied_for: string | null;
    application_id: number;
}

/** Manual send input: exactly ONE application, optional email override. */
export interface ManualSendNowInput {
    application_id: string | number;
    to_email?: string;
}

/** Manual send outcome: dispatch's { ok, reason? } verbatim. */
export interface ManualSendNowResult {
    ok: boolean;
    reason?: string;
}

interface Envelope<T> {
    success: boolean;
    data?: T;
    message?: string;
    errors?: Record<string, string[]>;
}

interface ApplicantListRow {
    id: number;
    full_name: string;
    position_applied_for: string | null;
    application_id: number | null;
}

/**
 * Lists sendable applicants (read-only over the existing applicants route;
 * drops rows without an application_id — nothing to key a manual send on).
 * @returns Envelope with the sendable picks.
 */
export async function listSendNowApplicants(): Promise<Envelope<SendNowApplicant[]>> {
    try {
        const res = await fetch("/api/hrm/applicants");
        if (!res.ok) return { success: false, message: "Failed to list applicants" };
        const body = (await res.json()) as { data?: ApplicantListRow[] };
        if (!Array.isArray(body?.data)) return { success: false, message: "Failed to list applicants" };
        return {
            success: true,
            data: body.data
                .filter(
                    (row): row is ApplicantListRow & { application_id: number } =>
                        typeof row?.application_id === "number"
                )
                .map((row) => ({
                    applicant_id: row.id,
                    full_name: row.full_name,
                    position_applied_for: row.position_applied_for,
                    application_id: row.application_id,
                })),
        };
    } catch {
        return { success: false, message: "Failed to list applicants" };
    }
}

/** Manual send input: one template + one application, optional email override
 * plus send-only customization (subject/body/vars overrides, never persisted). */
export interface ManualMailSendInput {
    template_id: string | number;
    application_id: string | number;
    to_email?: string;
    subject?: string;
    body_html?: string;
    vars?: Record<string, string>;
}

/** Manual send outcome: the endpoint's { ok, reason?, status } verbatim. */
export interface ManualMailSendResult {
    ok: boolean;
    reason?: string;
    status?: string;
    idempotency_key?: string;
}

/**
 * Fires ONE manual template send (single manual-send call, no count/bulk shape).
 * @param input - Exactly one template_id + one application_id, optional to_email
 * plus optional send-only subject/body_html/vars overrides.
 * @returns Envelope with the endpoint's { ok, reason?, status }.
 */
export async function postManualMailSend(
    input: ManualMailSendInput
): Promise<Envelope<ManualMailSendResult>> {
    try {
        const res = await fetch("/api/hrm/mailing/manual-send", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(input),
        });
        const body = (await res.json()) as Envelope<ManualMailSendResult>;
        if (!body.success) {
            const firstError = body.errors
                ? Object.values(body.errors).flat()[0]
                : undefined;
            return { success: false, message: firstError ?? body.message ?? "Send failed" };
        }
        return { success: true, data: body.data };
    } catch {
        return { success: false, message: "Send failed. Please try again later." };
    }
}
/**
 * Fires ONE manual invite send (single dispatch, no count/bulk shape).
 * @param input - Exactly one application_id + optional to_email override.
 * @returns Envelope with dispatch's { ok, reason? }.
 */
export async function postManualSendNow(
    input: ManualSendNowInput
): Promise<Envelope<ManualSendNowResult>> {
    try {
        const res = await fetch("/api/hrm/mailing/send-now", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(input),
        });
        const body = (await res.json()) as Envelope<ManualSendNowResult>;
        if (!body.success) {
            const firstError = body.errors
                ? Object.values(body.errors).flat()[0]
                : undefined;
            return { success: false, message: firstError ?? body.message ?? "Send failed" };
        }
        return { success: true, data: body.data };
    } catch {
        return { success: false, message: "Send failed. Please try again later." };
    }
}
