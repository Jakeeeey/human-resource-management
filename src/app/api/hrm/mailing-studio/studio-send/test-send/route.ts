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

export async function POST(req: NextRequest) {
    try {
        const body: unknown = await req.json().catch(() => null);
        const validation = testSendSchema.safeParse(body);
        if (!validation.success) {
            return validationFailed(validation.error.flatten().fieldErrors);
        }

        const { template_key, to_email } = validation.data;

        let template: Awaited<ReturnType<typeof getDesign>>;
        try {
            template = await getDesign(template_key);
        } catch (error) {
            if (error instanceof TypeError) throw error;
            template = null;
        }
        if (!template) {
            return NextResponse.json({ success: true, data: { ok: false, reason: "template-not-found" } });
        }

        const subject = typeof template.subject === "string" ? template.subject : "";
        const bodyHtml = typeof template.body_html === "string" ? template.body_html : "";
        const warnings: string[] = [];

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
