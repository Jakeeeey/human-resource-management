import { dFetch } from "@/modules/human-resource-management/shared/utils/directus";
import {
    getMsMailConfigStatus,
    getMsMailTransport,
    msLogRedacted,
    msScrubSecretsFromText,
} from "./mail-transport";
import { resolveRecipient } from "../utils/recipient";
import { renderTemplate } from "../utils/template-render";
import { msAssertMailableHtml, msHasForbiddenMailHtml } from "../utils/ms-html-scrub";
import { mailHtmlToText } from "../utils/ms-mail-text";

// Generic event dispatcher (P4-T3/P4-T4) — server-only send core over the
// ms_* collections via shared dFetch.
//
// Generalised from the recruitment-shaped core: the input is now a catalog
// event key plus an ARBITRARY payload (`{ event_key, payload,
// idempotency_key }`). The legacy recruitment-shaped context type is fully
// retired from this path — the signature below is the only input shape.
// Recipient resolution reads the payload's `to` key (D1, P4-T1);
// subject/body render open `{{tokens}}` against the payload with escaping
// (D3, P4-T2); bindings are selected by lowest id.
//
// Server-only: pulls in nodemailer transitively via mail-transport — never
// import this file (or mail-transport) from client components. Every exit
// path returns { ok, reason?, outcome? }; this function NEVER throws to the
// caller (send failure, lookup failure, rate cap — all caught and converted
// to outcomes + redacted logs).
//
// Persistence moved out (D2, P3-T2): the emit route owns the ms_outbox row
// (INSERT queued → dispatch → UPDATE terminal), so this module performs NO
// outbox writes and NO dedupe probe on the dispatch path — the row already
// exists for this key. The outcome it returns carries everything the route
// needs for the UPDATE. `writeOutboxRow` stays exported for the manual-send
// route, which owns its own rows.
//
// Pipeline order: validate args → enabled bindings (lowest id wins) →
// recipient resolve → template fetch → render + escape → scrub re-assert
// (rendered HTML) → plaintext → rate-cap check → dry_run outcome OR
// multipart/alternative send → outcome. No CC/BCC anywhere: single `to`
// only.

/** Generic dispatch input — catalog key plus an arbitrary payload. */
export interface DispatchInput {
    /** The emit payload (the only renderer/recipient value root). */
    payload?: Record<string, unknown>;
    /** Caller-built key (the emit route always derives one per §7.2). */
    idempotency_key?: string;
    /** Explicit recipient override (manual sends); wins over path resolution. */
    to_email?: string;
    /** Tolerated so pre-existing callers keep compiling; ignored. */
    [key: string]: unknown;
}

/** Dispatch outcome — the only shape this module ever returns to callers. */
export interface DispatchResult {
    ok: boolean;
    reason?: string;
    /** Terminal detail for the route's outbox UPDATE (absent when no send was attempted). */
    outcome?: DispatchOutcome;
}

/** Terminal send detail, mirroring the ms_outbox write shape. */
export interface DispatchOutcome {
    status: "sent" | "failed" | "skipped" | "dry_run" | "queued";
    to_email: string;
    template_id: string | number | null;
    warnings: string[];
    error: string | null;
    rendered_subject: string | null;
    rendered_body_html: string | null;
}

interface BindingRow {
    id: string | number;
    event_key: string;
    template_id: string | number;
    is_enabled: boolean;
}

interface TemplateRow {
    id: string | number;
    subject: string;
    body_html: string;
    is_active: boolean;
}

// Module-level sliding-60s send window (Appendix Env row: MAIL_RATE_PER_MINUTE,
// default 20). Pruned on every check; only real send attempts consume slots
// (skips/dupes/no-rows never append).
const sendTimestamps: number[] = [];

/**
 * Test-only reset for the sliding rate window (lets QA harnesses isolate
 * rate-cap asserts without waiting 60s). Never used by hook sites.
 */
export function resetDispatchRateWindow(): void {
    sendTimestamps.length = 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toBool(value: unknown): boolean {
    return value === true || value === 1 || value === "1" || value === "true";
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * PH-time producer (conventions.md §6): MySQL-compatible 'YYYY-MM-DD HH:mm:ss'
 * wall time for sent_at on real sends. Never server default / UTC toISOString.
 * @returns Current Philippine time as a MySQL-compatible string.
 */
export function getPhilippineTime(): string {
    return new Date().toLocaleString("sv-SE", { timeZone: "Asia/Manila" });
}

/**
 * Lists enabled bindings for the event (Directus filter), lowest id first.
 * @param eventKey - Catalog event key.
 * @returns Enabled binding rows (possibly empty).
 */
async function listEnabledBindings(eventKey: string): Promise<BindingRow[]> {
    const res = (await dFetch(
        `/items/ms_bindings?filter[event_key][_eq]=${encodeURIComponent(eventKey)}` +
            "&filter[is_enabled][_eq]=true" +
            "&limit=-1"
    )) as { data?: Record<string, unknown>[] };
    if (!Array.isArray(res?.data)) return [];
    const rows: BindingRow[] = [];
    for (const raw of res.data) {
        if (!isRecord(raw)) continue;
        rows.push({
            id: (raw.id as string | number) ?? "",
            event_key: String(raw.event_key ?? ""),
            template_id: (raw.template_id as string | number) ?? "",
            is_enabled: toBool(raw.is_enabled),
        });
    }
    rows.sort((a, b) => {
        const left = Number(a.id);
        const right = Number(b.id);
        if (Number.isFinite(left) && Number.isFinite(right) && left !== right) {
            return left - right;
        }
        return String(a.id).localeCompare(String(b.id));
    });
    return rows.filter((row) => row.is_enabled);
}

/**
 * Fetches the ms_templates row by id; inactive/missing yields null.
 * @param templateId - Template id from the binding.
 * @returns Template row, or null when missing/inactive.
 */
export async function fetchActiveTemplate(templateId: string | number): Promise<TemplateRow | null> {
    try {
        const res = (await dFetch(
            `/items/ms_templates/${encodeURIComponent(String(templateId))}` +
                "?fields=id,subject,body_html,is_active"
        )) as { data?: Record<string, unknown> };
        if (!isRecord(res?.data)) return null;
        const row = res.data;
        if (!toBool(row.is_active)) return null;
        if (typeof row.subject !== "string" || typeof row.body_html !== "string") return null;
        return {
            id: (row.id as string | number) ?? templateId,
            subject: row.subject,
            body_html: row.body_html,
            is_active: true,
        };
    } catch (error) {
        msLogRedacted("[dispatch-service] template fetch failed:", error);
        return null;
    }
}

interface OutboxWrite {
    idempotency_key: string;
    to_email: string;
    template_id: string | number | null;
    event_key: string;
    status: "sent" | "failed" | "skipped" | "dry_run";
    warnings: string[];
    error: string | null;
    sent_at: string | null;
    rendered_subject: string | null;
    rendered_body_html: string | null;
    /** §6.3 emit payload (the dispatcher path never sets it; the route does). */
    payload?: Record<string, unknown>;
    /** §6.3 relay counters (the dispatcher path never sets them; the route does). */
    attempts?: number;
    next_attempt_at?: string | null;
    published_at?: string | null;
}

/**
 * Outbox write inside its OWN try/catch: write failure is redacted-logged
 * and yields null — never thrown to the caller.
 * @param row - Outbox payload.
 * @returns True when the row was recorded.
 */
export async function writeOutboxRow(row: OutboxWrite): Promise<boolean> {
    try {
        await dFetch("/items/ms_outbox", {
            method: "POST",
            body: JSON.stringify({
                ...row,
                warnings: Array.isArray(row.warnings) ? row.warnings : [],
            }),
        });
        return true;
    } catch (error) {
        msLogRedacted("[dispatch-service] outbox write failed:", error);
        return false;
    }
}

/**
 * Rate-cap gate over the module sliding window (Appendix Env row).
 * @param cap - MAIL_RATE_PER_MINUTE (default 20).
 * @returns True when the send may proceed (slot consumed).
 */
export function takeRateSlot(cap: number): boolean {
    const now = Date.now();
    while (sendTimestamps.length > 0 && now - (sendTimestamps[0] as number) > 60_000) {
        sendTimestamps.shift();
    }
    const limit = Number.isFinite(cap) && cap > 0 ? cap : 20;
    if (sendTimestamps.length >= limit) return false;
    sendTimestamps.push(now);
    return true;
}

/**
 * Dispatches one mail for a catalog event. Resolves the enabled binding by
 * lowest id, resolves the recipient from the payload's `to` key
 * (explicit `to_email` override wins), renders `{{tokens}}` with escaping,
 * re-asserts the RENDERED HTML, sends single-`to` multipart/alternative
 * through getMsMailTransport() (or a dry_run outcome when MAIL_DRY_RUN
 * governs). NEVER throws; NEVER writes outbox rows (the emit route owns
 * the row and translates the returned outcome into its UPDATE).
 * @param eventKey - Catalog event key (already validated by the caller).
 * @param input - Generic dispatch input (payload + idempotency key).
 * @returns { ok, reason?, outcome? } — every path, including all failures.
 */
export async function dispatchMail(
    eventKey: string,
    input: DispatchInput
): Promise<DispatchResult> {
    try {
        if (typeof eventKey !== "string" || eventKey.length === 0 || !isRecord(input)) {
            return { ok: false, reason: "invalid-args" };
        }
        const key = input.idempotency_key;
        if (typeof key !== "string" || key.length === 0) {
            return { ok: false, reason: "invalid-args" };
        }
        const payload: Record<string, unknown> = isRecord(input.payload)
            ? input.payload
            : {};

        let bindings: BindingRow[];
        try {
            bindings = await listEnabledBindings(eventKey);
        } catch (error) {
            msLogRedacted("[dispatch-service] binding lookup failed:", error);
            return { ok: false, reason: "binding-lookup-failed" };
        }
        const binding = bindings.length > 0 ? bindings[0] : undefined;
        if (!binding) {
            msLogRedacted("[dispatch-service] no enabled binding for event:", {
                event_key: eventKey,
            });
            return {
                ok: false,
                reason: "no-enabled-binding",
                outcome: {
                    status: "queued",
                    to_email: "pending",
                    template_id: null,
                    warnings: [],
                    error: null,
                    rendered_subject: null,
                    rendered_body_html: null,
                },
            };
        }

        const override =
            typeof input.to_email === "string" ? input.to_email.trim() : "";
        const toEmail =
            override.length > 0
                ? override
                : resolveRecipient(payload);
        if (!EMAIL_PATTERN.test(toEmail)) {
            return {
                ok: false,
                reason: "skipped",
                outcome: {
                    status: "skipped",
                    to_email: toEmail.length > 0 ? toEmail : "unknown",
                    template_id: binding.template_id ?? null,
                    warnings: ["missing-or-invalid-recipient"],
                    error: null,
                    rendered_subject: null,
                    rendered_body_html: null,
                },
            };
        }

        const template = await fetchActiveTemplate(binding.template_id);
        if (!template) {
            return {
                ok: false,
                reason: "skipped",
                outcome: {
                    status: "skipped",
                    to_email: toEmail,
                    template_id: binding.template_id ?? null,
                    warnings: ["missing-or-inactive-template"],
                    error: null,
                    rendered_subject: null,
                    rendered_body_html: null,
                },
            };
        }

        const renderedSubject = renderTemplate(template.subject, { payload });
        const renderedBody = renderTemplate(template.body_html, { payload });
        const warnings = [...renderedSubject.warnings, ...renderedBody.warnings];
        const finalSubject = renderedSubject.html;
        const finalBody = renderedBody.html;

        const forbiddenReason = msAssertMailableHtml(finalBody);
        if (msHasForbiddenMailHtml(finalBody) || forbiddenReason) {
            return {
                ok: false,
                reason: "skipped",
                outcome: {
                    status: "skipped",
                    to_email: toEmail,
                    template_id: template.id,
                    warnings: [...warnings, `forbidden-html:${forbiddenReason ?? "rejected"}`],
                    error: null,
                    rendered_subject: finalSubject,
                    rendered_body_html: finalBody,
                },
            };
        }

        const textBody = mailHtmlToText(finalBody);

        const config = getMsMailConfigStatus();
        if (!takeRateSlot(config.ratePerMinute)) {
            msLogRedacted("[dispatch-service] rate cap hit:", {
                event_key: eventKey,
                ratePerMinute: config.ratePerMinute,
            });
            return {
                ok: false,
                reason: "rate-capped",
                outcome: {
                    status: "skipped",
                    to_email: toEmail,
                    template_id: template.id,
                    warnings: [...warnings, "rate-capped"],
                    error: null,
                    rendered_subject: finalSubject,
                    rendered_body_html: finalBody,
                },
            };
        }

        if (config.dryRun) {
            return {
                ok: true,
                outcome: {
                    status: "dry_run",
                    to_email: toEmail,
                    template_id: template.id,
                    warnings,
                    error: null,
                    rendered_subject: finalSubject,
                    rendered_body_html: finalBody,
                },
            };
        }

        let sendError: string | null = null;
        try {
            const { transporter } = await getMsMailTransport();
            const fromName = (process.env.MAIL_FROM_NAME ?? "").trim();
            const fromEmail = (process.env.MAIL_FROM_EMAIL ?? "").trim();
            await transporter.sendMail({
                from: fromName ? `"${fromName}" <${fromEmail}>` : fromEmail,
                to: toEmail,
                subject: finalSubject,
                text: textBody,
                html: finalBody,
            });
        } catch (error) {
            msLogRedacted("[dispatch-service] send failed:", error);
            sendError =
                error instanceof Error ? msScrubSecretsFromText(error.message) : "send failed";
        }

        if (sendError) {
            return {
                ok: false,
                reason: "send-failed",
                outcome: {
                    status: "failed",
                    to_email: toEmail,
                    template_id: template.id,
                    warnings,
                    error: sendError,
                    rendered_subject: finalSubject,
                    rendered_body_html: finalBody,
                },
            };
        }

        return {
            ok: true,
            outcome: {
                status: "sent",
                to_email: toEmail,
                template_id: template.id,
                warnings,
                error: null,
                rendered_subject: finalSubject,
                rendered_body_html: finalBody,
            },
        };
    } catch (error) {
        msLogRedacted("[dispatch-service] unexpected failure (never throw):", error);
        return { ok: false, reason: "internal-error" };
    }
}
