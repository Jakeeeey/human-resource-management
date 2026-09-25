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

export interface DispatchInput {
    payload?: Record<string, unknown>;
    idempotency_key?: string;
    to_email?: string;
    [key: string]: unknown;
}

export interface DispatchResult {
    ok: boolean;
    reason?: string;
    outcome?: DispatchOutcome;
}

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
    event_key_id: string | number;
    template_id: string | number;
    is_enabled: boolean;
}

interface TemplateRow {
    id: string | number;
    subject: string;
    body_html: string;
    is_active: boolean;
}

const sendTimestamps: number[] = [];

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

export function getPhilippineTime(): string {
    return new Date().toLocaleString("sv-SE", { timeZone: "Asia/Manila" });
}

async function getCatalogIdForKey(eventKey: string): Promise<string | null> {
    try {
        const res = (await dFetch(
            `/items/event_catalog?fields=id&filter[event_key][_eq]=${encodeURIComponent(eventKey)}&limit=1`
        )) as { data?: Record<string, unknown>[] };
        const row = Array.isArray(res?.data) ? res.data[0] : undefined;
        if (!isRecord(row)) return null;
        const id = row.id;
        if (typeof id === "string" && id.length > 0) return id;
        if (typeof id === "number" && Number.isFinite(id)) return String(id);
        return null;
    } catch (error) {
        msLogRedacted("[dispatch-service] catalog id lookup failed:", error);
        return null;
    }
}

async function listEnabledBindings(eventKey: string): Promise<BindingRow[]> {
    const catalogId = await getCatalogIdForKey(eventKey);
    if (catalogId === null) return [];
    const res = (await dFetch(
        `/items/ms_bindings?filter[event_key_id][_eq]=${encodeURIComponent(catalogId)}` +
            "&filter[is_enabled][_eq]=true" +
            "&limit=-1"
    )) as { data?: Record<string, unknown>[] };
    if (!Array.isArray(res?.data)) return [];
    const rows: BindingRow[] = [];
    for (const raw of res.data) {
        if (!isRecord(raw)) continue;
        rows.push({
            id: (raw.id as string | number) ?? "",
            event_key_id: (raw.event_key_id as string | number) ?? "",
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
    payload?: Record<string, unknown>;
    attempts?: number;
    next_attempt_at?: string | null;
    published_at?: string | null;
}

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
