import { dFetch } from "@/modules/human-resource-management/shared/utils/directus";

import { dispatchMail, getPhilippineTime } from "./dispatch-service";
import { msLogRedacted } from "./mail-transport";

// Relay core (P5-T1, §5 RELAY block + §7.6 relay policy) — server-only retry
// sweeper over ms_outbox via the shared dFetch transport (JSON-only REST).
//
// Policy, binding: max 8 attempts; backoff 1m, 5m, 15m, 1h, 6h, 24h, 24h,
// then exhausted; 50 rows per sweep; `published_at` is set only on a
// terminal state (sent, dry_run, skipped, or failed-after-exhaustion), so
// the `published_at IS NULL` selection is a superset of "still owes
// delivery" — a failed-but-unpublished row is retried, an exhausted one is
// published and stops being selected.
//
// Transport limitation, stated plainly: `FOR UPDATE SKIP LOCKED` cannot be
// expressed through the Directus REST API (dFetch is JSON-only HTTP — no
// raw SQL). The claim discipline is a unique-constraint insert: each
// sweeper POSTs (outbox_id, attempt) into ms_outbox_claims, whose UNIQUE
// index on (outbox_id, attempt) lets Postgres decide the winner — the
// first insert lands (2xx, this sweeper owns the row) and a concurrent
// loser gets a non-2xx conflict and skips the row. No filtered PATCH is
// used anywhere; every ms_outbox write goes by id. Two sweepers racing
// inside the same millisecond may still both dispatch before either claim
// lands — at-least-once delivery (§3.2) already assumes the consumer
// dedupes on `idempotency_key`, so a duplicate send is absorbed, never
// corrupt. Every exit path returns a count; this module NEVER throws.

const OUTBOX_COLLECTION = "/items/ms_outbox";
const CLAIMS_COLLECTION = "/items/ms_outbox_claims";

/** §7.6 relay policy: a row stops retrying after this many attempts. */
export const MS_RELAY_MAX_ATTEMPTS = 8;

/** §7.6 relay policy: rows re-driven per sweep (emit sweep + relay route). */
export const MS_RELAY_BATCH_SIZE = 50;

/** §7.6 terminal marker for an exhausted row. */
export const MS_RELAY_EXHAUSTED_ERROR = "relay-exhausted";

/**
 * §7.6 backoff ladder, in minutes: the delay scheduled after attempt N
 * fails lives at index N - 1 (attempts 1..7). Attempt 8 has no entry —
 * it exhausts the row instead.
 */
const RELAY_BACKOFF_MINUTES = [1, 5, 15, 60, 360, 1440, 1440];

/** One due outbox row, coerced into the §6.3 shape the relay re-drives. */
export interface RelayRow {
    id: string | number;
    event_key: string;
    payload: Record<string, unknown>;
    idempotency_key: string;
    attempts: number;
}

/** Sweep outcome — the exact `{ processed, sent, failed }` the route returns. */
export interface RelaySweepResult {
    processed: number;
    sent: number;
    failed: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Minutes to wait after attempt N fails, or null when the row is
 * exhausted (N >= MS_RELAY_MAX_ATTEMPTS).
 * @param attempts - Attempt count just consumed (1-based).
 */
export function backoffMinutesForAttempts(attempts: number): number | null {
    if (!Number.isInteger(attempts) || attempts < 1) return null;
    if (attempts >= MS_RELAY_MAX_ATTEMPTS) return null;
    const minutes = RELAY_BACKOFF_MINUTES[attempts - 1];
    return typeof minutes === "number" ? minutes : null;
}

/**
 * PH wall-clock timestamp a number of minutes in the future
 * (conventions: explicit app-side wall time, never DB defaults).
 */
function minutesFromNow(minutes: number): string {
    return new Date(Date.now() + minutes * 60_000).toLocaleString("sv-SE", {
        timeZone: "Asia/Manila",
    });
}

/**
 * Parses a candidate payload value into a record. Directus returns jsonb
 * as an object; a stored string is parsed once. Returns null when the
 * value cannot be read faithfully.
 */
function coercePayload(value: unknown): Record<string, unknown> | null {
    if (isRecord(value)) return value;
    if (typeof value === "string") {
        try {
            const parsed: unknown = JSON.parse(value);
            return isRecord(parsed) ? parsed : null;
        } catch {
            return null;
        }
    }
    return null;
}

/**
 * Coerces a raw Directus row into a RelayRow. Returns null when the row
 * cannot be re-driven faithfully (missing key, unreadable payload) — such
 * rows are left unpublished rather than terminally resolved on bad data.
 */
function toRelayRow(raw: unknown): RelayRow | null {
    if (!isRecord(raw)) return null;
    const id = raw.id;
    if (typeof id !== "string" && typeof id !== "number") return null;
    const eventKey = raw.event_key;
    if (typeof eventKey !== "string" || eventKey.length === 0) return null;
    const key = raw.idempotency_key;
    if (typeof key !== "string" || key.length === 0) return null;
    const payload = coercePayload(raw.payload);
    if (payload === null) return null;
    const attempts = raw.attempts;
    return {
        id,
        event_key: eventKey,
        payload,
        idempotency_key: key,
        attempts:
            typeof attempts === "number" && Number.isInteger(attempts) && attempts >= 0
                ? attempts
                : 0,
    };
}

/**
 * Lists due rows per the §7.6 claiming query: unpublished, under the
 * attempt cap, and (never scheduled OR past due), oldest-due first,
 * bounded to one batch. Failures yield an empty list, never a throw.
 */
export async function listDueRelayRows(
    limit: number = MS_RELAY_BATCH_SIZE,
): Promise<RelayRow[]> {
    const bounded =
        Number.isInteger(limit) && limit > 0
            ? Math.min(limit, MS_RELAY_BATCH_SIZE)
            : MS_RELAY_BATCH_SIZE;
    const now = getPhilippineTime();
    const query =
        `${OUTBOX_COLLECTION}?fields=id,event_key,payload,idempotency_key,attempts` +
        "&filter[published_at][_null]=true" +
        `&filter[attempts][_lt]=${MS_RELAY_MAX_ATTEMPTS}` +
        "&filter[_or][0][next_attempt_at][_null]=true" +
        `&filter[_or][1][next_attempt_at][_lte]=${encodeURIComponent(now)}` +
        `&sort=next_attempt_at,id&limit=${bounded}`;
    try {
        const res = (await dFetch(query)) as { data?: unknown[] };
        if (!Array.isArray(res?.data)) return [];
        const rows: RelayRow[] = [];
        for (const raw of res.data) {
            const row = toRelayRow(raw);
            if (row !== null) rows.push(row);
        }
        return rows;
    } catch (error) {
        msLogRedacted("[relay-service] due-row listing failed:", error);
        return [];
    }
}

/**
 * Unique-constraint claim: POSTs (outbox_id, attempt) into
 * ms_outbox_claims, whose UNIQUE index on (outbox_id, attempt) lets
 * Postgres pick the winner. 2xx = this sweeper owns the row; ANY failure
 * (conflict = another sweeper holds it, or a transient) yields false and
 * the row stays due for next time.
 */
async function tryClaimRelayRow(
    id: string | number,
    expectedAttempts: number,
): Promise<boolean> {
    try {
        const res = (await dFetch(CLAIMS_COLLECTION, {
            method: "POST",
            body: JSON.stringify({
                outbox_id: id,
                attempt: expectedAttempts + 1,
                claimed_at: getPhilippineTime(),
            }),
        })) as { data?: unknown; errors?: unknown };
        if (res !== null && typeof res === "object" && !("errors" in res) && "data" in res) {
            return true;
        }
        msLogRedacted("[relay-service] claim lost (row left due):", res);
        return false;
    } catch (error) {
        msLogRedacted("[relay-service] claim failed (row left due):", error);
        return false;
    }
}

/** Best-effort row PATCH (logged, never thrown). */
async function patchRelayRow(
    id: string | number,
    patch: Record<string, unknown>,
): Promise<void> {
    try {
        await dFetch(`${OUTBOX_COLLECTION}/${encodeURIComponent(String(id))}`, {
            method: "PATCH",
            body: JSON.stringify(patch),
        });
    } catch (error) {
        msLogRedacted("[relay-service] row PATCH failed:", error);
    }
}

/**
 * Re-drives one claimed row through the dispatcher. Terminal successes
 * (sent, dry_run, skipped) publish the row; failures reschedule with
 * backoff, or exhaust it at attempt 8 (`failed` + `relay-exhausted` +
 * `published_at`, so it stops being selected per gate G11).
 * @returns "sent" for sent/dry_run, "failed" for newly exhausted, else "pending".
 */
async function processRelayRow(row: RelayRow): Promise<"sent" | "failed" | "pending"> {
    const consumed = row.attempts + 1;
    const now = getPhilippineTime();

    let reason: string | undefined;
    let outcome: {
        status: string;
        to_email: string;
        template_id: string | number | null;
        warnings: string[];
        error: string | null;
        rendered_subject: string | null;
        rendered_body_html: string | null;
    } | null = null;
    try {
        const result = await dispatchMail(row.event_key, {
            payload: row.payload,
            idempotency_key: row.idempotency_key,
        });
        reason = result.ok ? undefined : result.reason;
        outcome = result.outcome ?? null;
    } catch (error) {
        msLogRedacted("[relay-service] dispatch threw (never throw):", error);
        reason = "dispatch-threw";
    }

    if (
        outcome !== null &&
        (outcome.status === "sent" ||
            outcome.status === "dry_run" ||
            outcome.status === "skipped")
    ) {
        await patchRelayRow(row.id, {
            status: outcome.status,
            to_email: outcome.to_email,
            template_id: outcome.template_id,
            warnings: outcome.warnings,
            error: null,
            sent_at: outcome.status === "sent" ? now : null,
            rendered_subject: outcome.rendered_subject,
            rendered_body_html: outcome.rendered_body_html,
            attempts: consumed,
            published_at: now,
        });
        return outcome.status === "skipped" ? "pending" : "sent";
    }

    if (consumed >= MS_RELAY_MAX_ATTEMPTS) {
        await patchRelayRow(row.id, {
            status: "failed",
            to_email: outcome?.to_email ?? "pending",
            template_id: outcome?.template_id ?? null,
            warnings: outcome?.warnings ?? [],
            error: MS_RELAY_EXHAUSTED_ERROR,
            rendered_subject: outcome?.rendered_subject ?? null,
            rendered_body_html: outcome?.rendered_body_html ?? null,
            attempts: consumed,
            published_at: now,
        });
        return "failed";
    }

    const backoff = backoffMinutesForAttempts(consumed);
    await patchRelayRow(row.id, {
        status: "queued",
        to_email: outcome?.to_email ?? "pending",
        template_id: outcome?.template_id ?? null,
        warnings: outcome?.warnings ?? [],
        error: outcome?.error ?? reason ?? "relay-retry",
        rendered_subject: outcome?.rendered_subject ?? null,
        rendered_body_html: outcome?.rendered_body_html ?? null,
        attempts: consumed,
        next_attempt_at: backoff === null ? null : minutesFromNow(backoff),
    });
    return "pending";
}

/**
 * Runs one bounded retry sweep: list due rows, claim each, re-drive it.
 * NEVER throws — every failure is logged and absorbed into the counts.
 * @param limit - Batch cap (clamped to MS_RELAY_BATCH_SIZE).
 */
export async function runRelaySweep(
    limit: number = MS_RELAY_BATCH_SIZE,
): Promise<RelaySweepResult> {
    const result: RelaySweepResult = { processed: 0, sent: 0, failed: 0 };
    try {
        const rows = await listDueRelayRows(limit);
        for (const row of rows) {
            try {
                const claimed = await tryClaimRelayRow(row.id, row.attempts);
                if (!claimed) continue;
                const fate = await processRelayRow(row);
                result.processed += 1;
                if (fate === "sent") result.sent += 1;
                else if (fate === "failed") result.failed += 1;
            } catch (error) {
                msLogRedacted("[relay-service] row handling failed:", error);
            }
        }
    } catch (error) {
        msLogRedacted("[relay-service] sweep failed (never throw):", error);
    }
    return result;
}
