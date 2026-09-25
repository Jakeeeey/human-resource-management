import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getDesign } from "@/modules/human-resource-management/mailing-studio/studio-templates/designer/services/design-persistence-service";
import { writeOutboxRow } from "@/modules/human-resource-management/mailing-studio/studio-bindings/events/services/dispatch-service";
import { buildTestIdempotencyKey } from "@/modules/human-resource-management/mailing-studio/studio-bindings/events/utils/ms-idempotency";
import {
    msAssertMailableHtml,
    msHasForbiddenMailHtml,
} from "@/modules/human-resource-management/mailing-studio/studio-bindings/events/utils/ms-html-scrub";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Template test-send endpoint (T4) — dry-run probe. Template-scoped, NOT
// event-scoped: it reads the saved ms_templates row, re-asserts the final
// canvas HTML with the scrub predicates, and records ONE `dry_run` ms_outbox
// row per click — it NEVER touches the transporter, so nothing is ever
// emailed. Rides the MANUAL-ONLY frozen event `final_interview.invited`
// (msEventKeySchema is frozen, so no new event key is invented); the row is
// marked with a `template-test` warning plus a `test:<template_key>:<epochMs>`
// idempotency key (buildTestIdempotencyKey — the dispatch-service test key
// formula) so probes are trivially distinguishable from real manual sends in
// the viewer.
//
// STRICT body: `{ template_key, to_email? }`. Absent to_email falls back to
// the probe constant (the row never sends — the address is label-only).
// No auth gate (mailing-probe posture like the sibling routes: the response
// carries only { ok, reason? } outcome booleans, never PII).

const TEST_PROBE_EMAIL = "dry-run@example.com";
const TEST_EVENT_KEY = "final_interview.invited" as const;

const testSendSchema = z
    .object({
        template_key: z.string().min(1),
        to_email: z.string().email().optional(),
    })
    .strict();

function validationFailed(errors: Record<string, string[]>) {
    return NextResponse.json(
        { success: false, message: "Validation failed", errors },
        { status: 400 }
    );
}

// POST /api/hrm/mailing-studio/test-send — record one dry_run probe row.
// Body: `{ template_key, to_email? }`. Never emails.
export async function POST(req: NextRequest) {
    try {
        const body: unknown = await req.json().catch(() => null);
        const validation = testSendSchema.safeParse(body);
        if (!validation.success) {
            return validationFailed(validation.error.flatten().fieldErrors);
        }

        const { template_key, to_email } = validation.data;

        // getDesign reads ms_templates by template_key (?filter= — a missing
        // row is null, never the Directus missing-single-item 403).
        let template: Awaited<ReturnType<typeof getDesign>>;
        try {
            template = await getDesign(template_key);
        } catch (error) {
            // Directus envelope errors answer the old probe's not-found shape;
            // transport/network failures (TypeError) fall through to 500.
            if (error instanceof TypeError) throw error;
            template = null;
        }
        if (!template) {
            return NextResponse.json({ success: true, data: { ok: false, reason: "template-not-found" } });
        }

        const subject = typeof template.subject === "string" ? template.subject : "";
        const bodyHtml = typeof template.body_html === "string" ? template.body_html : "";
        const warnings: string[] = [];

        // Canvas HTML is final (no renderer) — scrub re-assert only.
        const forbiddenReason = msAssertMailableHtml(bodyHtml);
        if (msHasForbiddenMailHtml(bodyHtml) || forbiddenReason) {
            warnings.push(`forbidden-html:${forbiddenReason ?? "rejected"}`);
        }
        warnings.push("template-test");

        const idempotencyKey = buildTestIdempotencyKey(template_key, Date.now());
        await writeOutboxRow({
            idempotency_key: idempotencyKey,
            to_email: to_email ?? TEST_PROBE_EMAIL,
            template_id: template.id ?? null,
            event_key: TEST_EVENT_KEY,
            status: "dry_run",
            warnings,
            error: null,
            sent_at: null,
            rendered_subject: subject,
            rendered_body_html: bodyHtml,
        });

        return NextResponse.json({ success: true, data: { ok: true, idempotency_key: idempotencyKey } });
    } catch (error) {
        console.error("[mailing-studio-test-send] probe error:", error);
        return NextResponse.json(
            { success: false, message: "An unexpected error occurred. Please try again later." },
            { status: 500 }
        );
    }
}
