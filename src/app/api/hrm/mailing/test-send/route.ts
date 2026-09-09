import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { dFetch } from "@/modules/human-resource-management/shared/utils/directus";
import { mailVarAllowlist } from "@/modules/human-resource-management/recruitment/mailing/types/mail-template.schema";
import { renderMailTemplate } from "@/modules/human-resource-management/recruitment/mailing/utils/mailRenderer";
import {
    assertMailableHtml,
    hasForbiddenMailHtml,
} from "@/modules/human-resource-management/recruitment/mailing/utils/mailScrub";
import { buildTestIdempotencyKey } from "@/modules/human-resource-management/recruitment/mailing/utils/idempotency";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Template test-send endpoint (dry-run probe — the "Save + dry-run
// test-send" button's missing half: it used to save + set a badge while
// writing ZERO outbox rows). Template-scoped, NOT event-scoped: it renders
// the saved template with blank sample vars and records ONE `dry_run`
// outbox row per click — it never touches the transporter, so nothing is
// ever emailed. Rides the MANUAL-ONLY frozen event `final_interview.invited`
// (mailEventKeySchema is frozen to 3 values, so no new event key is
// invented); the row is marked with a `template-test` warning plus a
// `test:<template_key>:<epochMs>` idempotency key so probes are trivially
// distinguishable from real manual sends in the viewer.
//
// No auth gate (mailing-probe posture like the sibling routes: the response
// carries only { ok, reason? } outcome booleans, never PII).

const TEST_PROBE_EMAIL = "dry-run@example.com";

const testSendSchema = z
    .object({
        template_key: z.string().min(1),
        to_email: z.string().email().optional(),
    })
    .strict();

// Preview sample vars: allowlisted blanks render `________________`
// cosmetically — same blanks the editor preview uses.
const SAMPLE_VARS = Object.fromEntries(mailVarAllowlist.map((name) => [name, "________________"]));

// POST /api/hrm/mailing/test-send — record one dry_run probe row.
// Body: `{ template_key, to_email? }`. Blank/absent to_email falls back to
// the probe constant (the row never sends — the address is label-only).
export async function POST(req: NextRequest) {
    try {
        const body: unknown = await req.json().catch(() => null);
        const validation = testSendSchema.safeParse(body);
        if (!validation.success) {
            return NextResponse.json(
                { success: false, message: "Validation failed", errors: validation.error.flatten().fieldErrors },
                { status: 400 }
            );
        }

        const { template_key, to_email } = validation.data;

        const lookup = (await dFetch(
            `/items/mail_templates?filter[template_key][_eq]=${encodeURIComponent(template_key)}&fields=id,template_key,subject,body_html&limit=1`
        )) as { data?: { id?: unknown; subject?: unknown; body_html?: unknown }[] };
        const template = Array.isArray(lookup?.data) ? lookup.data[0] : undefined;
        if (!template) {
            return NextResponse.json({ success: true, data: { ok: false, reason: "template-not-found" } });
        }

        const subjectRender = renderMailTemplate(typeof template.subject === "string" ? template.subject : "", SAMPLE_VARS);
        const bodyRender = renderMailTemplate(typeof template.body_html === "string" ? template.body_html : "", SAMPLE_VARS);
        const warnings = [...subjectRender.warnings, ...bodyRender.warnings];

        const forbiddenReason = assertMailableHtml(bodyRender.text);
        if (hasForbiddenMailHtml(bodyRender.text) || forbiddenReason) {
            warnings.push(`forbidden-html:${forbiddenReason ?? "rejected"}`);
        }
        warnings.push("template-test");

        const idempotencyKey = buildTestIdempotencyKey(template_key, Date.now());
        await dFetch("/items/mail_outbox", {
            method: "POST",
            body: JSON.stringify({
                idempotency_key: idempotencyKey,
                to_email: to_email ?? TEST_PROBE_EMAIL,
                template_id: template.id ?? null,
                event_key: "final_interview.invited",
                status: "dry_run",
                warnings,
                error: null,
                sent_at: null,
                rendered_subject: subjectRender.text,
                rendered_body_html: bodyRender.text,
            }),
        });

        return NextResponse.json({ success: true, data: { ok: true, idempotency_key: idempotencyKey } });
    } catch (error) {
        console.error("[mailing-test-send] probe error:", error);
        return NextResponse.json(
            { success: false, message: "An unexpected error occurred. Please try again later." },
            { status: 500 }
        );
    }
}
