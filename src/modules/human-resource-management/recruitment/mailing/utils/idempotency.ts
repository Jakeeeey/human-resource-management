// Idempotency key builders (Appendix Idempotency keys row — exact formulas).
//
// Auto (dispatch from a hook window):   <event_key>:<application_id>:<interview_id>
// Manual (Send-now click, unique/click): <event_key>:<application_id>:manual-<epochMs>
// Test (template probe click, unique):   test:<template_key>:<epochMs>
//
// The outbox carries a unique index on idempotency_key: a repeated auto key
// dedupes (double-dispatch = single row); every manual click mints a fresh
// epochMs so it is never deduped. Pure + server-safe (string ops only).

/**
 * Builds the deterministic auto-send key for hook-window dispatches.
 * @param eventKey - Frozen event key (e.g. initial_interview.graded).
 * @param applicationId - Applicant application id.
 * @param interviewId - Interview row id.
 * @returns `<event_key>:<application_id>:<interview_id>`.
 */
export function buildAutoIdempotencyKey(
    eventKey: string,
    applicationId: string | number,
    interviewId: string | number
): string {
    return `${eventKey}:${applicationId}:${interviewId}`;
}

/**
 * Builds the unique-per-click manual key for Send-now dispatches.
 * @param eventKey - Frozen event key (final_interview.invited).
 * @param applicationId - Applicant application id.
 * @param epochMs - Click-time epoch millis (Date.now()).
 * @returns `<event_key>:<application_id>:manual-<epochMs>`.
 */
export function buildManualIdempotencyKey(
    eventKey: string,
    applicationId: string | number,
    epochMs: number
): string {
    return `${eventKey}:${applicationId}:manual-${epochMs}`;
}

/**
 * Builds the unique-per-click test key for template dry-run probes.
 * @param templateKey - Saved template_key under test.
 * @param epochMs - Click-time epoch millis (Date.now()).
 * @returns `test:<template_key>:<epochMs>`.
 */
export function buildTestIdempotencyKey(
    templateKey: string,
    epochMs: number
): string {
    return `test:${templateKey}:${epochMs}`;
}
