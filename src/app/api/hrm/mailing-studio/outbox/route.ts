import { NextRequest, NextResponse } from "next/server";
import { msOutboxStatusSchema } from "@/modules/human-resource-management/mailing-studio/types/ms-outbox.schema";
import { msToMaskedOutboxRow } from "@/modules/human-resource-management/mailing-studio/utils/ms-mask";
import { dFetch } from "@/modules/human-resource-management/shared/utils/directus";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/hrm/mailing-studio/outbox?status=<queued|sent|failed|skipped|dry_run>
//
// Status-only outbox viewer (D17 — NO resend endpoint exists on this path;
// PATCH/DELETE are not exported, so Next answers 405). Unlike the old
// login-gated unmasked viewer, this route MASKS `to_email` at the edge via
// utils/ms-mask (msToMaskedOutboxRow): full addresses never leave the server,
// including `warnings`/`error` echoes (scrubbed for email-like substrings).
// No Zod body validation: GET has no body; the `status` query value is
// validated against msOutboxStatusSchema and an unknown value answers 400
// (never 500, never an ambiguous empty 200). Byte-parity with the old
// api/hrm/mailing/outbox route (READ-ONLY reference) for envelope + status
// codes; rows are masked projections of ms_outbox.

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
            const parsed = msOutboxStatusSchema.safeParse(statusParam);
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

        // Snapshot columns (`rendered_subject`/`rendered_body_html`) may lack a
        // Directus read grant — Directus answers unknown fields with 400
        // (surfaced by dFetch as a body without `data`), so degrade
        // full+rendered → full → base instead of breaking the list (same
        // fallback shape as the old route). Each step runs only on a no-`data`
        // answer, so a denied grant on the snapshot fields yields a working
        // list without them, never a 500/403 to the client. `warnings` is a
        // JSON column that may or may not carry a grant — same retry rule one
        // level down.
        const rendered = (await dFetch(
            `/items/ms_outbox?fields=${OUTBOX_FIELDS_RENDERED}&sort=-id&limit=-1${statusFilter}`
        )) as { data?: Record<string, unknown>[] };
        let rows = Array.isArray(rendered?.data) ? rendered.data : null;
        if (!rows) {
            const full = (await dFetch(
                `/items/ms_outbox?fields=${OUTBOX_FIELDS_FULL}&sort=-id&limit=-1${statusFilter}`
            )) as { data?: Record<string, unknown>[] };
            rows = Array.isArray(full?.data) ? full.data : null;
        }
        if (!rows) {
            const base = (await dFetch(
                `/items/ms_outbox?fields=${OUTBOX_FIELDS_BASE}&sort=-id&limit=-1${statusFilter}`
            )) as { data?: Record<string, unknown>[] };
            rows = Array.isArray(base?.data) ? base.data : null;
        }
        if (!rows) {
            console.error("[mailing-studio-outbox] list: Directus returned no data array");
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
            data: rows.map(msToMaskedOutboxRow),
        });
    } catch (error) {
        console.error("[mailing-studio-outbox] list error:", error);
        return NextResponse.json(
            {
                success: false,
                message: "An unexpected error occurred. Please try again later.",
            },
            { status: 500 }
        );
    }
}
