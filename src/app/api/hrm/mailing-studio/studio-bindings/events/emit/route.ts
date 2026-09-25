import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

import {
    MS_EMIT_PAYLOAD_MAX,
    deriveIdempotencyKey,
    isActiveCatalogKey,
    serializedPayloadSize,
    validatePayload,
} from "@/modules/human-resource-management/mailing-studio/studio-bindings/events/services/catalog-guard";
import {
    dispatchMail,
    getPhilippineTime,
    type DispatchOutcome,
} from "@/modules/human-resource-management/mailing-studio/studio-bindings/events/services/dispatch-service";
import { runRelaySweep } from "@/modules/human-resource-management/mailing-studio/studio-bindings/events/services/relay-service";
import { msEventKeyShapeSchema } from "@/modules/human-resource-management/mailing-studio/studio-bindings/catalog/ms-catalog.schema";
import { dFetch } from "@/modules/human-resource-management/shared/utils/directus";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Emit surface (P3-T2, §5 + §7.1 + §7.2 + §7.6) — the ONLY surface modules
// touch: `POST /api/hrm/mailing-studio/emit` with `{ event_key, payload,
// idempotency_key? }`.
//
// Pipeline in this exact order: authenticate (→401) → validate `event_key`
// against the catalog (→422 UNKNOWN_EVENT_KEY) → validate payload
// size/shape (→413 / 422 INVALID_PAYLOAD) → derive the idempotency key
// (§7.2) → dedupe probe (→409 duplicate) → INSERT the ms_outbox row
// (status=queued, payload stored, rendered_* null) → dispatch synchronously
// → UPDATE the same row to sent | failed-path-queued | skipped | dry_run
// → opportunistic relay sweep of a bounded stale batch (P5-T3: no
// scheduler required for correctness).
//
// The route NEVER throws: every failure — including Directus outages and
// unexpected exceptions — is a JSON envelope. Server-side Next code may
// bypass HTTP entirely by importing `emitEvent` directly (preferred,
// §7.6); any other internal caller presents
// `X-Internal-Emit: <MAIL_INTERNAL_EMIT_TOKEN>`, constant-time compared.
// A browser/unauthenticated caller gets 401 and no row is written.

const OUTBOX_COLLECTION = "/items/ms_outbox";

const TOP_LEVEL_KEYS = ["event_key", "payload", "idempotency_key"] as const;

let tokenWarningLogged = false;

/**
 * Constant-time string equality (length check first — timingSafeEqual
 * throws on mismatched lengths).
 */
function constantTimeEqual(a: string, b: string): boolean {
    const left = Buffer.from(a, "utf8");
    const right = Buffer.from(b, "utf8");
    if (left.length !== right.length) return false;
    return timingSafeEqual(left, right);
}

/**
 * §7.6 emit authentication. Token configured → the header must match it.
 * Token unset → only same-origin server calls are accepted (server fetch
 * carries no Sec-Fetch-Mode; browsers always do) plus a one-time startup
 * warning.
 */
export function isEmitAuthorized(req: NextRequest): boolean {
    const token = (process.env.MAIL_INTERNAL_EMIT_TOKEN ?? "").trim();
    if (token.length > 0) {
        const presented = (req.headers.get("x-internal-emit") ?? "").trim();
        if (presented.length === 0) return false;
        return constantTimeEqual(presented, token);
    }
    if (!tokenWarningLogged) {
        tokenWarningLogged = true;
        console.warn(
            "[mailing-studio-emit] MAIL_INTERNAL_EMIT_TOKEN is unset — accepting only same-origin server calls",
        );
    }
    return req.headers.get("sec-fetch-mode") === null;
}

function unauthorized() {
    return NextResponse.json(
        { success: false, message: "UNAUTHORIZED" },
        { status: 401 },
    );
}

function malformed(message: string, errors?: Record<string, string[]>) {
    return NextResponse.json(
        { success: false, message, ...(errors ? { errors } : {}) },
        { status: 400 },
    );
}

function invalidPayload(errors: Record<string, string[]>) {
    return NextResponse.json(
        { success: false, message: "INVALID_PAYLOAD", errors },
        { status: 422 },
    );
}

interface EmitInput {
    event_key: string;
    payload: Record<string, unknown>;
    idempotency_key?: string;
}

/**
 * Rejects prototype-pollution keys, unknown top-level keys, and mistyped
 * `event_key`/`idempotency_key`. The `payload` value itself is validated
 * separately (arbitrary nested object within the §7.6 limits).
 */
function rejectSuspiciousEmitBody(body: unknown): Record<string, string[]> | null {
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
        return { _body: ["Request body must be a JSON object"] };
    }
    const record = body as Record<string, unknown>;
    const errors: Record<string, string[]> = {};
    for (const key of Object.keys(record)) {
        if (key === "__proto__" || key === "constructor" || key === "prototype") {
            errors[key] = [`Forbidden field: ${key}`];
            continue;
        }
        if (!(TOP_LEVEL_KEYS as readonly string[]).includes(key)) {
            errors[key] = [`Unknown field: ${key}`];
        }
    }
    if (record.event_key !== undefined && typeof record.event_key !== "string") {
        errors.event_key = ["Event key must be a string"];
    }
    if (
        record.idempotency_key !== undefined &&
        (typeof record.idempotency_key !== "string" || record.idempotency_key.length === 0)
    ) {
        errors.idempotency_key = ["Idempotency key must be a non-empty string"];
    }
    return Object.keys(errors).length > 0 ? errors : null;
}

/**
 * Dedupe probe: true when an ms_outbox row already carries this key. A
 * failed probe fails OPEN (proceeds) — the UNIQUE index on
 * `idempotency_key` is the backstop and a colliding INSERT is converted
 * to a duplicate below.
 */
async function idempotencyKeyExists(key: string): Promise<boolean> {
    try {
        const res = (await dFetch(
            `${OUTBOX_COLLECTION}?filter[idempotency_key][_eq]=${encodeURIComponent(key)}&fields=id&limit=1`,
        )) as { data?: unknown[] };
        return Array.isArray(res?.data) && res.data.length > 0;
    } catch (error) {
        console.error("[mailing-studio-emit] dedupe probe failed (proceeding):", error);
        return false;
    }
}

/**
 * INSERTs the queued outbox row (D2: outbox-first). Returns the row id, or
 * null when the write failed. Unknown-column tolerance: pre-Phase-1-DDL
 * Directus shapes ignore the new columns and the row still records.
 */
async function insertQueuedRow(input: {
    event_key: string;
    payload: Record<string, unknown>;
    idempotency_key: string;
}): Promise<string | number | null> {
    try {
        const res = (await dFetch(OUTBOX_COLLECTION, {
            method: "POST",
            body: JSON.stringify({
                idempotency_key: input.idempotency_key,
                to_email: "pending",
                template_id: null,
                event_key: input.event_key,
                status: "queued",
                warnings: [],
                error: null,
                sent_at: null,
                rendered_subject: null,
                rendered_body_html: null,
                payload: input.payload,
                attempts: 0,
                next_attempt_at: null,
                published_at: null,
            }),
        })) as { data?: { id?: string | number } };
        const echoId = res?.data?.id;
        if (typeof echoId === "string" || typeof echoId === "number") return echoId;
    } catch (error) {
        console.error("[mailing-studio-emit] outbox INSERT failed:", error);
        return null;
    }
    try {
        const lookup = (await dFetch(
            `${OUTBOX_COLLECTION}?filter[idempotency_key][_eq]=${encodeURIComponent(input.idempotency_key)}&fields=id&limit=1`,
        )) as { data?: { id?: string | number }[] };
        const row = Array.isArray(lookup?.data) ? lookup.data[0] : undefined;
        const id = row?.id;
        return typeof id === "string" || typeof id === "number" ? id : null;
    } catch (error) {
        console.error("[mailing-studio-emit] outbox read-back failed:", error);
        return null;
    }
}

/** PATCHes the queued row to its terminal state (best-effort, logged). */
async function updateOutboxRow(
    id: string | number,
    patch: Record<string, unknown>,
): Promise<void> {
    try {
        await dFetch(`${OUTBOX_COLLECTION}/${encodeURIComponent(String(id))}`, {
            method: "PATCH",
            body: JSON.stringify(patch),
        });
    } catch (error) {
        console.error("[mailing-studio-emit] outbox UPDATE failed:", error);
    }
}

/** PH wall-clock timestamp one minute in the future (relay backoff step 1). */
function nextAttemptAt(): string {
    return new Date(Date.now() + 60_000).toLocaleString("sv-SE", {
        timeZone: "Asia/Manila",
    });
}

export interface EmitResult {
    status: number;
    body: Record<string, unknown>;
}

/**
 * Writes the dispatch outcome back to the queued row and builds the emit
 * response. Terminal successes (sent, dry_run, skipped) publish the row;
 * a failed dispatch leaves it queued with attempts=1 and the first backoff
 * step due, so the relay (or the next emit's sweep) retries it.
 */
async function finalizeEmitRow(
    outboxId: string | number,
    outcome: DispatchOutcome,
    now: string,
): Promise<EmitResult> {
    switch (outcome.status) {
        case "sent":
            await updateOutboxRow(outboxId, {
                status: "sent",
                to_email: outcome.to_email,
                template_id: outcome.template_id,
                warnings: outcome.warnings,
                error: null,
                sent_at: now,
                rendered_subject: outcome.rendered_subject,
                rendered_body_html: outcome.rendered_body_html,
                published_at: now,
            });
            return {
                status: 200,
                body: { success: true, data: { status: "sent", outbox_id: outboxId } },
            };
        case "dry_run":
            await updateOutboxRow(outboxId, {
                status: "dry_run",
                to_email: outcome.to_email,
                template_id: outcome.template_id,
                warnings: outcome.warnings,
                error: null,
                sent_at: null,
                rendered_subject: outcome.rendered_subject,
                rendered_body_html: outcome.rendered_body_html,
                published_at: now,
            });
            return {
                status: 200,
                body: { success: true, data: { status: "dry_run", outbox_id: outboxId } },
            };
        case "skipped":
            await updateOutboxRow(outboxId, {
                status: "skipped",
                to_email: outcome.to_email,
                template_id: outcome.template_id,
                warnings: outcome.warnings,
                error: null,
                sent_at: null,
                rendered_subject: outcome.rendered_subject,
                rendered_body_html: outcome.rendered_body_html,
                published_at: now,
            });
            return {
                status: 200,
                body: { success: true, data: { status: "skipped", outbox_id: outboxId } },
            };
        case "failed":
            await updateOutboxRow(outboxId, {
                status: "queued",
                to_email: outcome.to_email,
                template_id: outcome.template_id,
                warnings: outcome.warnings,
                error: outcome.error,
                rendered_subject: outcome.rendered_subject,
                rendered_body_html: outcome.rendered_body_html,
                attempts: 1,
                next_attempt_at: nextAttemptAt(),
            });
            return {
                status: 200,
                body: { success: true, data: { status: "queued", outbox_id: outboxId } },
            };
        case "queued":
        default:
            await updateOutboxRow(outboxId, {
                status: "queued",
                warnings: outcome.warnings,
            });
            return {
                status: 200,
                body: { success: true, data: { status: "queued", outbox_id: outboxId } },
            };
    }
}

/**
 * Core emit pipeline (server-callable; the POST handler is a thin auth +
 * JSON wrapper around this). Never throws — every path returns a status +
 * envelope body.
 * /param input - Validated emit input (shape-checked, key unchecked).
 */
export async function emitEvent(input: EmitInput): Promise<EmitResult> {
    const shape = msEventKeyShapeSchema.safeParse(input.event_key);
    if (!shape.success) {
        return {
            status: 400,
            body: {
                success: false,
                message: "Validation failed",
                errors: { event_key: ["Invalid event key shape"] },
            },
        };
    }
    const eventKey = shape.data;

    if (!(await isActiveCatalogKey(eventKey))) {
        console.error("[mailing-studio-emit] UNKNOWN_EVENT_KEY:", eventKey);
        return {
            status: 422,
            body: { success: false, message: "UNKNOWN_EVENT_KEY", event_key: eventKey },
        };
    }

    if (serializedPayloadSize(input.payload) > MS_EMIT_PAYLOAD_MAX) {
        return { status: 413, body: { success: false, message: "PAYLOAD_TOO_LARGE" } };
    }
    const payloadCheck = await validatePayload(eventKey, input.payload);
    if (!payloadCheck.ok) {
        return {
            status: 422,
            body: { success: false, message: "INVALID_PAYLOAD", errors: payloadCheck.errors },
        };
    }

    const key = deriveIdempotencyKey(eventKey, input.payload, input.idempotency_key);
    if (await idempotencyKeyExists(key)) {
        return { status: 409, body: { success: true, data: { status: "duplicate" } } };
    }

    const outboxId = await insertQueuedRow({
        event_key: eventKey,
        payload: input.payload,
        idempotency_key: key,
    });
    if (outboxId === null) {
        if (await idempotencyKeyExists(key)) {
            return { status: 409, body: { success: true, data: { status: "duplicate" } } };
        }
        return {
            status: 500,
            body: { success: false, message: "Failed to record outbox row. Please try again later." },
        };
    }

    const result = await dispatchMail(eventKey, {
        payload: input.payload,
        idempotency_key: key,
    });
    const outcome = result.outcome;
    const now = getPhilippineTime();

    let emitResponse: EmitResult;
    if (!outcome) {
        await updateOutboxRow(outboxId, {
            status: "queued",
            error: result.reason ?? "dispatch-failed",
        });
        emitResponse = {
            status: 200,
            body: { success: true, data: { status: "queued", outbox_id: outboxId } },
        };
    } else {
        emitResponse = await finalizeEmitRow(outboxId, outcome, now);
    }

    try {
        await runRelaySweep();
    } catch (error) {
        console.error("[mailing-studio-emit] opportunistic relay sweep failed:", error);
    }
    return emitResponse;
}

// POST /api/hrm/mailing-studio/emit — `{ event_key, payload, idempotency_key? }`.
export async function POST(req: NextRequest) {
    try {
        if (!isEmitAuthorized(req)) return unauthorized();

        let body: unknown = null;
        try {
            body = (await req.json()) as unknown;
        } catch {
            body = null;
        }
        const suspicious = rejectSuspiciousEmitBody(body);
        if (suspicious) {
            return malformed("Validation failed", suspicious);
        }
        const record = body as Record<string, unknown>;
        const rawKey = record.event_key;
        if (typeof rawKey !== "string" || rawKey.length === 0) {
            return malformed("Validation failed", { event_key: ["Event key is required"] });
        }
        const rawPayload = record.payload;
        if (
            typeof rawPayload !== "object" ||
            rawPayload === null ||
            Array.isArray(rawPayload)
        ) {
            return invalidPayload({ payload: ["Payload must be a JSON object"] });
        }
        const rawCallerKey = record.idempotency_key;

        const result = await emitEvent({
            event_key: rawKey,
            payload: rawPayload as Record<string, unknown>,
            ...(typeof rawCallerKey === "string" ? { idempotency_key: rawCallerKey } : {}),
        });
        return NextResponse.json(result.body, { status: result.status });
    } catch (error) {
        console.error("[mailing-studio-emit] unexpected failure (never throw):", error);
        return NextResponse.json(
            { success: false, message: "An unexpected error occurred. Please try again later." },
            { status: 500 },
        );
    }
}
