import { dFetch } from "@/modules/human-resource-management/shared/utils/directus";
import {
    getMailConfigStatus,
    getMailTransport,
} from "../providers/mailTransport";
import { buildAutoIdempotencyKey } from "./idempotency";
import { logRedacted, scrubSecretsFromText } from "./mailLog";
import { hasForbiddenMailHtml, assertMailableHtml } from "./mailScrub";
import { renderMailTemplate } from "./mailRenderer";
import { mailHtmlToText } from "./mailText";

// Dispatch core (mailing-module todo 10, Appendix DispatchCtx row).
//
// Server-only: pulls in nodemailer transitively via mailTransport — never
// import this file (or mailTransport) from client components. Every exit
// path returns { ok, reason? }; this function NEVER throws to the caller
// (send failure, write failure, malformed ctx, rate cap — all caught and
// converted to outcome rows + redacted logs).
//
// Pipeline order: validate ctx → idempotency key → dedupe check → enabled
// binding (+ send_condition match) → recipient resolve → template fetch →
// render (allowlist + warnings) → server string-predicate re-assert →
// plaintext → rate-cap check → dry_run write OR multipart/alternative send
// → outbox write (own try/catch). No CC/BCC anywhere: single `to` only.
//
// Two deliberate choices (recorded in task-10 evidence):
// - send_condition MISMATCH writes NO outbox row (the condition means "don't
//   send for this outcome" — there is no send attempt to record), same as
//   the no-enabled-binding path.
// - duplicate key returns { ok:false, reason:"duplicate" } without writing.

/** Frozen event keys accepted by dispatch (Appendix Events row). */
const FROZEN_EVENT_KEYS = [
    "initial_interview.graded",
    "final_interview.graded",
    "final_interview.invited",
    "onboarding.profile_created",
    "onboarding.docs_verified",
    "onboarding.training_completed",
    "onboarding.completed",
] as const;

type FrozenEventKey = (typeof FROZEN_EVENT_KEYS)[number];

/** Dispatch context (Appendix DispatchCtx row + to_email override for todo 12 manual sends). */
export interface DispatchCtx {
    event_key: string;
    application_id: string | number;
    interview_id?: string | number;
    verdict?: string;
    decision_id?: string | number;
    vars: Record<string, string>;
    /** Manual-send override: the picked applicant's email (todo 12). Defaults to application.email lookup. */
    to_email?: string;
    /** Manual-send override: caller-built key (buildManualIdempotencyKey). Defaults to the auto key. */
    idempotency_key?: string;
}

/** Dispatch outcome — the only shape this module ever returns to callers. */
export interface DispatchResult {
    ok: boolean;
    reason?: string;
}

interface BindingRow {
    id: string | number;
    event_key: string;
    template_id: string | number;
    is_enabled: boolean;
    send_condition: string;
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

function isFrozenEventKey(value: unknown): value is FrozenEventKey {
    return (
        typeof value === "string" &&
        (FROZEN_EVENT_KEYS as readonly string[]).includes(value)
    );
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
 * Matches a binding's send_condition against the dispatch verdict (Appendix
 * Bindings row): `always` fires regardless; `on_pass` needs Passed/pass;
 * `on_fail` needs Failed/fail (case-insensitive).
 * @param condition - Binding send_condition value.
 * @param verdict - Dispatch verdict (may be undefined for invite sends).
 * @returns True when the binding fires for this verdict.
 */
export function matchSendCondition(condition: unknown, verdict: unknown): boolean {
    if (condition === "always") return true;
    const normalized = typeof verdict === "string" ? verdict.trim().toLowerCase() : "";
    if (condition === "on_pass") return normalized === "passed" || normalized === "pass";
    if (condition === "on_fail") return normalized === "failed" || normalized === "fail";
    return false;
}

/**
 * Resolves the recipient: ctx.to_email override wins (todo 12 manual sends);
 * otherwise reads application.email from the application record.
 * @param ctx - Dispatch context.
 * @returns Trimmed email, or "" when missing/unresolvable.
 */
export async function resolveRecipientEmail(ctx: DispatchCtx): Promise<string> {
    try {
        if (typeof ctx.to_email === "string" && ctx.to_email.trim().length > 0) {
            return ctx.to_email.trim();
        }
        const res = (await dFetch(
            `/items/application?filter[id][_eq]=${encodeURIComponent(String(ctx.application_id))}&fields=id,email&limit=1`
        )) as { data?: Record<string, unknown>[] };
        const row = Array.isArray(res?.data) ? res.data[0] : undefined;
        const email = isRecord(row) ? row.email : undefined;
        return typeof email === "string" ? email.trim() : "";
    } catch (error) {
        logRedacted("[dispatchMail] recipient lookup failed:", error);
        return "";
    }
}

/**
 * Lists enabled bindings for the event (Directus filter), most-specific
 * condition first (on_pass/on_fail beat always), then lowest id.
 * @param eventKey - Frozen event key.
 * @returns Enabled binding rows (possibly empty).
 */
async function listEnabledBindings(eventKey: string): Promise<BindingRow[]> {
    const res = (await dFetch(
        `/items/mail_hook_bindings?filter[event_key][_eq]=${encodeURIComponent(eventKey)}` +
            "&filter[is_enabled][_eq]=true" +
            "&fields=id,event_key,template_id,is_enabled,send_condition&limit=-1"
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
            send_condition: String(raw.send_condition ?? ""),
        });
    }
    rows.sort((a, b) => {
        const aSpecific = a.send_condition === "always" ? 1 : 0;
        const bSpecific = b.send_condition === "always" ? 1 : 0;
        if (aSpecific !== bSpecific) return aSpecific - bSpecific;
        return Number(a.id) - Number(b.id);
    });
    return rows.filter((row) => row.is_enabled);
}

/**
 * Fetches the template row by id; inactive/missing yields null.
 * @param templateId - Template id from the binding.
 * @returns Template row, or null when missing/inactive.
 */
export async function fetchActiveTemplate(templateId: string | number): Promise<TemplateRow | null> {
    try {
        const res = (await dFetch(
            `/items/mail_templates/${encodeURIComponent(String(templateId))}` +
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
        logRedacted("[dispatchMail] template fetch failed:", error);
        return null;
    }
}

/**
 * Dedupe probe: true when an outbox row already carries this key.
 * @param key - Idempotency key.
 * @returns True when the key was already recorded.
 */
async function idempotencyKeyExists(key: string): Promise<boolean> {
    try {
        const res = (await dFetch(
            `/items/mail_outbox?filter[idempotency_key][_eq]=${encodeURIComponent(key)}&fields=id&limit=1`
        )) as { data?: unknown[] };
        return Array.isArray(res?.data) && res.data.length > 0;
    } catch (error) {
        logRedacted("[dispatchMail] dedupe probe failed (proceeding):", error);
        return false;
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
}

/**
 * Outbox write inside its OWN try/catch: write failure is redacted-logged
 * and yields null — never thrown to the caller.
 * @param row - Outbox payload.
 * @returns True when the row was recorded.
 */
export async function writeOutboxRow(row: OutboxWrite): Promise<boolean> {
    try {
        await dFetch("/items/mail_outbox", {
            method: "POST",
            body: JSON.stringify({
                ...row,
                warnings: Array.isArray(row.warnings) ? row.warnings : [],
            }),
        });
        return true;
    } catch (error) {
        logRedacted("[dispatchMail] outbox write failed:", error);
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
 * Dispatches one mail for an event (Appendix DispatchCtx row).
 * Resolves the enabled binding (+ send_condition), renders via
 * renderMailTemplate, sends single-`to` multipart/alternative through
 * getMailTransport() (or a dry_run row when MAIL_DRY_RUN governs), and
 * records the outcome row keyed by the idempotency key. NEVER throws.
 * @param eventKey - Frozen event key.
 * @param ctx - Dispatch context (application/interview/verdict/vars).
 * @returns { ok, reason? } — every path, including all failures.
 */
export async function dispatchMail(
    eventKey: string,
    ctx: DispatchCtx
): Promise<DispatchResult> {
    try {
        if (!isFrozenEventKey(eventKey) || !isRecord(ctx)) {
            return { ok: false, reason: "invalid-args" };
        }
        const applicationId = ctx.application_id;
        if (
            (typeof applicationId !== "string" && typeof applicationId !== "number") ||
            String(applicationId).trim().length === 0
        ) {
            return { ok: false, reason: "invalid-args" };
        }
        const vars =
            isRecord(ctx.vars) && !Array.isArray(ctx.vars)
                ? (ctx.vars as Record<string, string>)
                : {};

        const autoKey =
            ctx.interview_id !== undefined && ctx.interview_id !== null
                ? buildAutoIdempotencyKey(eventKey, applicationId, ctx.interview_id)
                : null;
        const key =
            typeof ctx.idempotency_key === "string" && ctx.idempotency_key.length > 0
                ? ctx.idempotency_key
                : autoKey;
        if (!key) {
            return { ok: false, reason: "missing-key" };
        }

        if (await idempotencyKeyExists(key)) {
            return { ok: false, reason: "duplicate" };
        }

        let bindings: BindingRow[];
        try {
            bindings = await listEnabledBindings(eventKey);
        } catch (error) {
            logRedacted("[dispatchMail] binding lookup failed:", error);
            return { ok: false, reason: "binding-lookup-failed" };
        }
        const binding = bindings.find((row) =>
            matchSendCondition(row.send_condition, ctx.verdict)
        );
        if (!binding) {
            const anyEnabled = bindings.length > 0;
            logRedacted("[dispatchMail] no firing binding for event:", {
                event_key: eventKey,
                anyEnabled,
            });
            return {
                ok: false,
                reason: anyEnabled ? "condition-mismatch" : "no-enabled-binding",
            };
        }

        const toEmail = await resolveRecipientEmail(ctx);
        if (!EMAIL_PATTERN.test(toEmail)) {
            await writeOutboxRow({
                idempotency_key: key,
                to_email: toEmail.length > 0 ? toEmail : "unknown",
                template_id: binding.template_id ?? null,
                event_key: eventKey,
                status: "skipped",
                warnings: ["missing-or-invalid-recipient"],
                error: null,
                sent_at: null,
                rendered_subject: null,
                rendered_body_html: null,
            });
            return { ok: false, reason: "skipped" };
        }

        const template = await fetchActiveTemplate(binding.template_id);
        if (!template) {
            await writeOutboxRow({
                idempotency_key: key,
                to_email: toEmail,
                template_id: binding.template_id ?? null,
                event_key: eventKey,
                status: "skipped",
                warnings: ["missing-or-inactive-template"],
                error: null,
                sent_at: null,
                rendered_subject: null,
                rendered_body_html: null,
            });
            return { ok: false, reason: "skipped" };
        }

        const renderedSubject = renderMailTemplate(template.subject, vars);
        const renderedBody = renderMailTemplate(template.body_html, vars, { boldVars: true });
        const warnings = [...renderedSubject.warnings, ...renderedBody.warnings];

        const forbiddenReason = assertMailableHtml(renderedBody.text);
        if (hasForbiddenMailHtml(renderedBody.text) || forbiddenReason) {
            await writeOutboxRow({
                idempotency_key: key,
                to_email: toEmail,
                template_id: template.id,
                event_key: eventKey,
                status: "skipped",
                warnings: [...warnings, `forbidden-html:${forbiddenReason ?? "rejected"}`],
                error: null,
                sent_at: null,
                rendered_subject: renderedSubject.text,
                rendered_body_html: renderedBody.text,
            });
            return { ok: false, reason: "skipped" };
        }

        const textBody = mailHtmlToText(renderedBody.text);

        const config = getMailConfigStatus();
        if (!takeRateSlot(config.ratePerMinute)) {
            await writeOutboxRow({
                idempotency_key: key,
                to_email: toEmail,
                template_id: template.id,
                event_key: eventKey,
                status: "skipped",
                warnings: [...warnings, "rate-capped"],
                error: null,
                sent_at: null,
                rendered_subject: renderedSubject.text,
                rendered_body_html: renderedBody.text,
            });
            logRedacted("[dispatchMail] rate cap hit:", {
                event_key: eventKey,
                ratePerMinute: config.ratePerMinute,
            });
            return { ok: false, reason: "rate-capped" };
        }

        if (config.dryRun) {
            await writeOutboxRow({
                idempotency_key: key,
                to_email: toEmail,
                template_id: template.id,
                event_key: eventKey,
                status: "dry_run",
                warnings,
                error: null,
                sent_at: null,
                rendered_subject: renderedSubject.text,
                rendered_body_html: renderedBody.text,
            });
            return { ok: true };
        }

        let sendError: string | null = null;
        try {
            const { transporter } = await getMailTransport();
            const fromName = (process.env.MAIL_FROM_NAME ?? "").trim();
            const fromEmail = (process.env.MAIL_FROM_EMAIL ?? "").trim();
            await transporter.sendMail({
                from: fromName ? `"${fromName}" <${fromEmail}>` : fromEmail,
                to: toEmail,
                subject: renderedSubject.text,
                text: textBody,
                html: renderedBody.text,
            });
        } catch (error) {
            logRedacted("[dispatchMail] send failed:", error);
            sendError =
                error instanceof Error ? scrubSecretsFromText(error.message) : "send failed";
        }

        if (sendError) {
            await writeOutboxRow({
                idempotency_key: key,
                to_email: toEmail,
                template_id: template.id,
                event_key: eventKey,
                status: "failed",
                warnings,
                error: sendError,
                sent_at: null,
                rendered_subject: renderedSubject.text,
                rendered_body_html: renderedBody.text,
            });
            return { ok: false, reason: "send-failed" };
        }

        await writeOutboxRow({
            idempotency_key: key,
            to_email: toEmail,
            template_id: template.id,
            event_key: eventKey,
            status: "sent",
            warnings,
            error: null,
            sent_at: getPhilippineTime(),
            rendered_subject: renderedSubject.text,
            rendered_body_html: renderedBody.text,
        });
        return { ok: true };
    } catch (error) {
        logRedacted("[dispatchMail] unexpected failure (never throw):", error);
        return { ok: false, reason: "internal-error" };
    }
}
