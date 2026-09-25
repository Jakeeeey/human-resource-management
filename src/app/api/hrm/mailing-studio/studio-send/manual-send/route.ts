import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
    fetchActiveTemplate,
    getPhilippineTime,
    takeRateSlot,
    writeOutboxRow,
} from "@/modules/human-resource-management/mailing-studio/studio-bindings/events/services/dispatch-service";
import {
    getMsMailConfigStatus,
    getMsMailTransport,
    msLogRedacted,
    msScrubSecretsFromText,
} from "@/modules/human-resource-management/mailing-studio/studio-bindings/events/services/mail-transport";
import { MS_BODY_HTML_MAX } from "@/modules/human-resource-management/mailing-studio/studio-bindings/events/types/ms-template.schema";
import { buildManualIdempotencyKey } from "@/modules/human-resource-management/mailing-studio/studio-bindings/events/utils/ms-idempotency";
import {
    msAssertMailableHtml,
    msHasForbiddenMailHtml,
} from "@/modules/human-resource-management/mailing-studio/studio-bindings/events/utils/ms-html-scrub";
import { mailHtmlToText } from "@/modules/human-resource-management/mailing-studio/studio-bindings/events/utils/ms-mail-text";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Manual Send endpoint (T4) — mirrors the old api/hrm/mailing/manual-send
// semantics (READ-ONLY reference) on the mailing-studio stack: template-
// scoped, NOT binding-scoped; the caller picks a template + recipient, and
// this route records exactly ONE ms_outbox row per click — `sent` on
// delivery, `dry_run` when MAIL_DRY_RUN governs (default true), `skipped`/
// `failed` honestly otherwise. Rides the MANUAL-ONLY frozen event
// `final_interview.invited` (the enum is frozen — no new event key); every
// row carries a `manual-send` warning plus a fresh buildManualIdempotencyKey
// so clicks are never deduped.
//
// STRICT body: `{ template_id, to_email, subject?, body_html? }` — single-to
// only; subject/body_html overrides are send-only (never persisted to the
// template) and the final HTML is re-asserted with the server scrub
// predicates. The send block rides dispatch-service exports
// (fetchActiveTemplate/writeOutboxRow/takeRateSlot/getPhilippineTime +
// mail-transport) so it mirrors dispatch exactly (multipart/alternative,
// from-name formatting, PH sent_at, scrubbed failure text). One outbox row
// per click on EVERY path. No auth gate (mailing-probe posture like the
// sibling routes: the response carries only { ok, reason?, status } outcome
// fields, never PII).

const MANUAL_EVENT_KEY = "final_interview.invited" as const;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const manualSendSchema = z
    .object({
        template_id: z.union([z.string().min(1), z.number().int()]),
        to_email: z.string().email("Recipient email must be valid"),
        subject: z.string().trim().min(1).max(500).optional(),
        body_html: z
            .string()
            .min(1)
            .max(MS_BODY_HTML_MAX, `Body must be at most ${MS_BODY_HTML_MAX} characters`)
            .optional(),
    })
    .strict();

function validationFailed(errors: Record<string, string[]>) {
    return NextResponse.json(
        { success: false, message: "Validation failed", errors },
        { status: 400 }
    );
}

// POST /api/hrm/mailing-studio/manual-send — one template + one recipient
// per click. Body: `{ template_id, to_email, subject?, body_html? }`.
export async function POST(req: NextRequest) {
    try {
        const body: unknown = await req.json().catch(() => null);
        const validation = manualSendSchema.safeParse(body);
        if (!validation.success) {
            return validationFailed(validation.error.flatten().fieldErrors);
        }

        const { template_id, to_email, subject, body_html } = validation.data;
        const customized = subject !== undefined || body_html !== undefined;
        const idempotencyKey = buildManualIdempotencyKey(
            MANUAL_EVENT_KEY,
            template_id,
            Date.now()
        );

        const template = await fetchActiveTemplate(template_id);
        if (!template) {
            await writeOutboxRow({
                idempotency_key: idempotencyKey,
                to_email,
                template_id: template_id ?? null,
                event_key: MANUAL_EVENT_KEY,
                status: "skipped",
                warnings: ["manual-send", "missing-or-inactive-template"],
                error: null,
                sent_at: null,
                rendered_subject: null,
                rendered_body_html: null,
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

        if (!EMAIL_PATTERN.test(to_email)) {
            await writeOutboxRow({
                idempotency_key: idempotencyKey,
                to_email: "unknown",
                template_id: template.id,
                event_key: MANUAL_EVENT_KEY,
                status: "skipped",
                warnings: ["manual-send", "missing-or-invalid-recipient"],
                error: null,
                sent_at: null,
                rendered_subject: null,
                rendered_body_html: null,
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

        // Send-only overrides (never persisted): override ?? template value.
        // Canvas HTML is final — no {{var}} renderer — so the strings go
        // through the server scrub re-assert as-is.
        const finalSubject = subject ?? template.subject;
        const finalBody = body_html ?? template.body_html;
        const warnings = ["manual-send"];

        const forbiddenReason = msAssertMailableHtml(finalBody);
        if (msHasForbiddenMailHtml(finalBody) || forbiddenReason) {
            await writeOutboxRow({
                idempotency_key: idempotencyKey,
                to_email,
                template_id: template.id,
                event_key: MANUAL_EVENT_KEY,
                status: "skipped",
                warnings: [...warnings, `forbidden-html:${forbiddenReason ?? "rejected"}`],
                error: null,
                sent_at: null,
                rendered_subject: finalSubject,
                rendered_body_html: finalBody,
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

        const textBody = mailHtmlToText(finalBody);

        const config = getMsMailConfigStatus();
        if (!takeRateSlot(config.ratePerMinute)) {
            await writeOutboxRow({
                idempotency_key: idempotencyKey,
                to_email,
                template_id: template.id,
                event_key: MANUAL_EVENT_KEY,
                status: "skipped",
                warnings: [...warnings, "rate-capped"],
                error: null,
                sent_at: null,
                rendered_subject: finalSubject,
                rendered_body_html: finalBody,
            });
            msLogRedacted("[mailing-studio-manual-send] rate cap hit:", {
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
                to_email,
                template_id: template.id,
                event_key: MANUAL_EVENT_KEY,
                status: "dry_run",
                warnings,
                error: null,
                sent_at: null,
                rendered_subject: finalSubject,
                rendered_body_html: finalBody,
            });
            return NextResponse.json({
                success: true,
                data: { ok: true, status: "dry_run", idempotency_key: idempotencyKey, customized },
            });
        }

        let sendError: string | null = null;
        try {
            const { transporter } = await getMsMailTransport();
            const fromName = (process.env.MAIL_FROM_NAME ?? "").trim();
            const fromEmail = (process.env.MAIL_FROM_EMAIL ?? "").trim();
            await transporter.sendMail({
                from: fromName ? `"${fromName}" <${fromEmail}>` : fromEmail,
                to: to_email,
                subject: finalSubject,
                text: textBody,
                html: finalBody,
            });
        } catch (error) {
            msLogRedacted("[mailing-studio-manual-send] send failed:", error);
            sendError =
                error instanceof Error ? msScrubSecretsFromText(error.message) : "send failed";
        }

        if (sendError) {
            await writeOutboxRow({
                idempotency_key: idempotencyKey,
                to_email,
                template_id: template.id,
                event_key: MANUAL_EVENT_KEY,
                status: "failed",
                warnings,
                error: sendError,
                sent_at: null,
                rendered_subject: finalSubject,
                rendered_body_html: finalBody,
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
            to_email,
            template_id: template.id,
            event_key: MANUAL_EVENT_KEY,
            status: "sent",
            warnings,
            error: null,
            sent_at: getPhilippineTime(),
            rendered_subject: finalSubject,
            rendered_body_html: finalBody,
        });
        return NextResponse.json({
            success: true,
            data: { ok: true, status: "sent", idempotency_key: idempotencyKey, customized },
        });
    } catch (error) {
        console.error("[mailing-studio-manual-send] send error:", error);
        return NextResponse.json(
            { success: false, message: "An unexpected error occurred. Please try again later." },
            { status: 500 }
        );
    }
}
