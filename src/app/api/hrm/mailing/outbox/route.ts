import { NextRequest, NextResponse } from "next/server";
import { dFetch } from "@/modules/human-resource-management/shared/utils/directus";
import { mailOutboxStatusSchema } from "@/modules/human-resource-management/recruitment/mailing/types/mail-outbox.schema";
import { toMaskedOutboxRow } from "@/modules/human-resource-management/recruitment/mailing/utils/mailMask";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/hrm/mailing/outbox?status=<queued|sent|failed|skipped|dry_run>
//
// Status-only outbox viewer (D17 — no resend endpoint exists on this path).
// Read-only: no auth gate by design (same posture as the sibling health
// probe) because the payload carries NO PII — `to_email` leaves this server
// masked (`j***@domain`) and `warnings`/`error` echoes are scrubbed for
// email-like substrings. No Zod body validation: GET has no body; the
// `status` query value is validated against `mailOutboxStatusSchema` and an
// unknown value answers 400 (never 500, never an ambiguous empty 200).

const OUTBOX_FIELDS_RENDERED =
    "id,idempotency_key,to_email,template_id,event_key,status,warnings,error,sent_at,rendered_subject,rendered_body_html";
const OUTBOX_FIELDS_FULL =
    "id,idempotency_key,to_email,template_id,event_key,status,warnings,error,sent_at";
const OUTBOX_FIELDS_BASE =
    "id,idempotency_key,to_email,template_id,event_key,status,error,sent_at";

export async function GET(req: NextRequest) {
    try {
        const statusParam = req.nextUrl.searchParams.get("status");
        let statusFilter = "";
        if (statusParam !== null) {
            const parsed = mailOutboxStatusSchema.safeParse(statusParam);
            if (!parsed.success) {
                return NextResponse.json(
                    {
                        success: false,
                        message: `Invalid status filter "${statusParam}". Allowed values: queued, sent, failed, skipped, dry_run.`,
                    },
                    { status: 400 }
                );
            }
            statusFilter = `&filter[status][_eq]=${parsed.data}`;
        }

        // Snapshot columns (`rendered_subject`/`rendered_body_html`, todo 21)
        // may lack a Directus read grant — Directus answers unknown fields
        // with 400 (surfaced by dFetch as a body without `data`), so degrade
        // full+rendered → full → base instead of breaking the list (same
        // fallback shape as the company-logos route). Each step runs only on
        // a no-`data` answer, so a denied grant on the new fields yields a
        // working list without snapshots, never a 500/403 to the client.
        // `warnings` is a JSON column the user-created schema may or may not
        // carry yet — same retry rule one level down.
        const rendered = (await dFetch(
            `/items/mail_outbox?fields=${OUTBOX_FIELDS_RENDERED}&sort=-id&limit=-1${statusFilter}`
        )) as { data?: Record<string, unknown>[] };
        let rows = Array.isArray(rendered?.data) ? rendered.data : null;
        if (!rows) {
            const full = (await dFetch(
                `/items/mail_outbox?fields=${OUTBOX_FIELDS_FULL}&sort=-id&limit=-1${statusFilter}`
            )) as { data?: Record<string, unknown>[] };
            rows = Array.isArray(full?.data) ? full.data : null;
        }
        if (!rows) {
            const base = (await dFetch(
                `/items/mail_outbox?fields=${OUTBOX_FIELDS_BASE}&sort=-id&limit=-1${statusFilter}`
            )) as { data?: Record<string, unknown>[] };
            rows = Array.isArray(base?.data) ? base.data : null;
        }
        if (!rows) {
            console.error("[mailing-outbox] list: Directus returned no data array");
            return NextResponse.json(
                {
                    success: false,
                    message: "Unable to read the mail outbox. Please try again later.",
                },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            data: rows.map(toMaskedOutboxRow),
        });
    } catch (error) {
        console.error("[mailing-outbox] list error:", error);
        return NextResponse.json(
            {
                success: false,
                message: "An unexpected error occurred. Please try again later.",
            },
            { status: 500 }
        );
    }
}
