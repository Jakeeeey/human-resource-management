import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
    getMailConfigStatus,
    getMailTransport,
} from "@/modules/human-resource-management/recruitment/mailing/providers/mailTransport";
import {
    fetchActiveTemplate,
    getPhilippineTime,
    resolveRecipientEmail,
    takeRateSlot,
    writeOutboxRow,
} from "@/modules/human-resource-management/recruitment/mailing/utils/dispatchMail";
import { buildManualIdempotencyKey } from "@/modules/human-resource-management/recruitment/mailing/utils/idempotency";
import { logRedacted, scrubSecretsFromText } from "@/modules/human-resource-management/recruitment/mailing/utils/mailLog";
import { renderMailTemplate } from "@/modules/human-resource-management/recruitment/mailing/utils/mailRenderer";
import {
    assertMailableHtml,
    hasForbiddenMailHtml,
} from "@/modules/human-resource-management/recruitment/mailing/utils/mailScrub";
import {
    MAIL_BODY_HTML_MAX,
    mailVarAllowlist,
} from "@/modules/human-resource-management/recruitment/mailing/types/mail-template.schema";
import { mailHtmlToText } from "@/modules/human-resource-management/recruitment/mailing/utils/mailText";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Manual Send endpoint (always-visible Manual Send section). Template-scoped,
// NOT binding-scoped: the caller picks a template + an applicant, and this
// route records exactly ONE outbox row per click — `sent` on delivery,
// `dry_run` when MAIL_DRY_RUN governs, `skipped`/`failed` honestly otherwise.
// Rides the MANUAL-ONLY frozen event `final_interview.invited` (no new event
// key — the enum is frozen); every row carries a `manual-send` warning plus a
// fresh `buildManualIdempotencyKey` key so clicks are never deduped.
//
// Sends render with the per-send vars (missing allowlisted vars render `""`
// silently — never the `____` preview blanks; unknown vars render `""` +
// warnings, same renderer rule). Helpers are reused
// from dispatchMail (shared-infrastructure exports, behavior unchanged) so the
// send block mirrors dispatchMail exactly (multipart/alternative, from-name
// formatting, PH sent_at, scrubbed failure text).
//
// No auth gate (mailing-probe posture like the sibling routes: the response
// carries only { ok, reason?, status } outcome fields, never PII).

const MANUAL_EVENT_KEY = "final_interview.invited" as const;

const VAR_KEY_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;
const ALLOWED_MANUAL_VARS = new Set<string>(mailVarAllowlist as readonly string[]);

const manualSendSchema = z
    .object({
        template_id: z.union([z.string().min(1), z.number().int()]),
        application_id: z.union([z.string().min(1), z.number()]),
        to_email: z.string().email().optional(),
        subject: z.string().trim().min(1).max(500).optional(),
        body_html: z.string().min(1).max(MAIL_BODY_HTML_MAX).optional(),
        vars: z.record(z.string(), z.string()).optional(),
    })
    .strict();

/**
 * Sanitizes per-send vars: keeps allowlisted keys with trimmed values ≤500
 * chars; drops bad-shape keys, unknown vars, and overlong values. Dropped
 * unknown tokens still render as "" + `unknown-var:x` warnings via the
 * renderer, which persist on the outbox row.
 */
function sanitizeManualVars(raw: unknown): Record<string, string> {
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return {};
    const clean: Record<string, string> = {};
    for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
        if (!VAR_KEY_PATTERN.test(key)) continue;
        if (!ALLOWED_MANUAL_VARS.has(key)) continue;
        if (typeof value !== "string") continue;
        const trimmed = value.trim();
        if (trimmed.length === 0 || trimmed.length > 500) continue;
        clean[key] = trimmed;
    }
    return clean;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validationFailed(errors: Record<string, string[]>) {
    return NextResponse.json(
        { success: false, message: "Validation failed", errors },
        { status: 400 }
    );
}

// POST /api/hrm/mailing/manual-send — one template + one applicant per click.
// Body: `{ template_id, application_id, to_email?, subject?, body_html?, vars? }`
// (all overrides optional and send-only — never persisted to the template).
// Blank/absent to_email falls back to the application record's email (skipped
// row when unresolvable — never throws).
export async function POST(req: NextRequest) {
    try {
        const body: unknown = await req.json().catch(() => null);
        const validation = manualSendSchema.safeParse(body);
        if (!validation.success) {
            return validationFailed(validation.error.flatten().fieldErrors);
        }

        const { template_id, application_id, to_email, subject, body_html, vars } = validation.data;
        const sendVars = sanitizeManualVars(vars);
        const customized =
            subject !== undefined || body_html !== undefined || Object.keys(sendVars).length > 0;
        const idempotencyKey = buildManualIdempotencyKey(
            MANUAL_EVENT_KEY,
            application_id,
            Date.now()
        );

        const template = await fetchActiveTemplate(template_id);
        if (!template) {
            await writeOutboxRow({
                idempotency_key: idempotencyKey,
                to_email: "unknown",
                template_id: template_id ?? null,
                event_key: MANUAL_EVENT_KEY,
                status: "skipped",
                warnings: ["manual-send", "missing-or-inactive-template"],
                error: null,
                sent_at: null,
            });
            return NextResponse.json({
                success: true,
                data: {
                    ok: false,
                    reason: "template-not-found",
                    status: "skipped",
                    idempotency_key: idempotencyKey,
                },
            });
        }

        const toEmail = await resolveRecipientEmail({
            event_key: MANUAL_EVENT_KEY,
            application_id,
            vars: sendVars,
            ...(typeof to_email === "string" ? { to_email } : {}),
        });
        if (!EMAIL_PATTERN.test(toEmail)) {
            await writeOutboxRow({
                idempotency_key: idempotencyKey,
                to_email: toEmail.length > 0 ? toEmail : "unknown",
                template_id: template.id,
                event_key: MANUAL_EVENT_KEY,
                status: "skipped",
                warnings: ["manual-send", "missing-or-invalid-recipient"],
                error: null,
                sent_at: null,
            });
            return NextResponse.json({
                success: true,
                data: {
                    ok: false,
                    reason: "missing-or-invalid-recipient",
                    status: "skipped",
                    idempotency_key: idempotencyKey,
                },
            });
        }

        // Send-only overrides (never persisted): override ?? template value,
        // then rendered with the per-send vars (replacing the old `{}`).
        const renderedSubject = renderMailTemplate(subject ?? template.subject, sendVars);
        const renderedBody = renderMailTemplate(body_html ?? template.body_html, sendVars);
        const warnings = [...renderedSubject.warnings, ...renderedBody.warnings, "manual-send"];

        const forbiddenReason = assertMailableHtml(renderedBody.text);
        if (hasForbiddenMailHtml(renderedBody.text) || forbiddenReason) {
            await writeOutboxRow({
                idempotency_key: idempotencyKey,
                to_email: toEmail,
                template_id: template.id,
                event_key: MANUAL_EVENT_KEY,
                status: "skipped",
                warnings: [...warnings, `forbidden-html:${forbiddenReason ?? "rejected"}`],
                error: null,
                sent_at: null,
            });
            return NextResponse.json({
                success: true,
                data: {
                    ok: false,
                    reason: "forbidden-html",
                    status: "skipped",
                    idempotency_key: idempotencyKey,
                },
            });
        }

        const textBody = mailHtmlToText(renderedBody.text);

        const config = getMailConfigStatus();
        if (!takeRateSlot(config.ratePerMinute)) {
            await writeOutboxRow({
                idempotency_key: idempotencyKey,
                to_email: toEmail,
                template_id: template.id,
                event_key: MANUAL_EVENT_KEY,
                status: "skipped",
                warnings: [...warnings, "rate-capped"],
                error: null,
                sent_at: null,
            });
            logRedacted("[mailing-manual-send] rate cap hit:", {
                event_key: MANUAL_EVENT_KEY,
                ratePerMinute: config.ratePerMinute,
            });
            return NextResponse.json({
                success: true,
                data: {
                    ok: false,
                    reason: "rate-capped",
                    status: "skipped",
                    idempotency_key: idempotencyKey,
                },
            });
        }

        if (config.dryRun) {
            await writeOutboxRow({
                idempotency_key: idempotencyKey,
                to_email: toEmail,
                template_id: template.id,
                event_key: MANUAL_EVENT_KEY,
                status: "dry_run",
                warnings,
                error: null,
                sent_at: null,
            });
            return NextResponse.json({
                success: true,
                data: { ok: true, status: "dry_run", idempotency_key: idempotencyKey, customized },
            });
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
            logRedacted("[mailing-manual-send] send failed:", error);
            sendError =
                error instanceof Error ? scrubSecretsFromText(error.message) : "send failed";
        }

        if (sendError) {
            await writeOutboxRow({
                idempotency_key: idempotencyKey,
                to_email: toEmail,
                template_id: template.id,
                event_key: MANUAL_EVENT_KEY,
                status: "failed",
                warnings,
                error: sendError,
                sent_at: null,
            });
            return NextResponse.json({
                success: true,
                data: {
                    ok: false,
                    reason: "send-failed",
                    status: "failed",
                    idempotency_key: idempotencyKey,
                },
            });
        }

        await writeOutboxRow({
            idempotency_key: idempotencyKey,
            to_email: toEmail,
            template_id: template.id,
            event_key: MANUAL_EVENT_KEY,
            status: "sent",
            warnings,
            error: null,
            sent_at: getPhilippineTime(),
        });
        return NextResponse.json({
            success: true,
            data: { ok: true, status: "sent", idempotency_key: idempotencyKey, customized },
        });
    } catch (error) {
        console.error("[mailing-manual-send] send error:", error);
        return NextResponse.json(
            { success: false, message: "An unexpected error occurred. Please try again later." },
            { status: 500 }
        );
    }
}
