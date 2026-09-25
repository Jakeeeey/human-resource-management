import { NextRequest, NextResponse } from "next/server";
import { msToMaskedOutboxRow } from "@/modules/human-resource-management/mailing-studio/studio-outbox/utils/ms-mask";
import { dFetch } from "@/modules/human-resource-management/shared/utils/directus";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/hrm/mailing-studio/outbox/[id]
//
// Status-only single-row viewer (D17 — NO resend endpoint exists on this
// path; PATCH/DELETE are not exported, so Next answers 405). MASKS `to_email`
// at the edge via utils/ms-mask (msToMaskedOutboxRow) — full addresses never
// leave the server, including `warnings`/`error` echoes. Unknown id answers
// 404 (never 500, never an empty row). Envelope + status codes mirror the old
// api/hrm/mailing/outbox/[id] route (READ-ONLY reference).

const OUTBOX_FIELDS_RENDERED =
    "id,idempotency_key,to_email,template_id,event_key,status,warnings,error,sent_at,attempts,next_attempt_at,rendered_subject,rendered_body_html";
const OUTBOX_FIELDS_FULL =
    "id,idempotency_key,to_email,template_id,event_key,status,warnings,error,sent_at,attempts,next_attempt_at";
const OUTBOX_FIELDS_BASE =
    "id,idempotency_key,to_email,template_id,event_key,status,error,sent_at";

export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const resolvedParams = await params;
        const id = resolvedParams.id;
        if (!id) {
            return NextResponse.json(
                { success: false, message: "Outbox id is required." },
                { status: 400 }
            );
        }

        // Same full+rendered → full → base degradation as the list route:
        // each retry runs only on a no-`data` answer, so a denied grant on the
        // snapshot columns degrades instead of 404ing the row.
        const rendered = (await dFetch(
            `/items/ms_outbox/${encodeURIComponent(id)}?fields=${OUTBOX_FIELDS_RENDERED}`
        )) as { data?: Record<string, unknown> };
        let row =
            rendered?.data && typeof rendered.data === "object" ? rendered.data : null;
        if (!row) {
            const full = (await dFetch(
                `/items/ms_outbox/${encodeURIComponent(id)}?fields=${OUTBOX_FIELDS_FULL}`
            )) as { data?: Record<string, unknown> };
            row =
                full?.data && typeof full.data === "object" ? full.data : null;
        }
        if (!row) {
            const base = (await dFetch(
                `/items/ms_outbox/${encodeURIComponent(id)}?fields=${OUTBOX_FIELDS_BASE}`
            )) as { data?: Record<string, unknown> };
            row =
                base?.data && typeof base.data === "object"
                    ? base.data
                    : null;
        }
        if (!row) {
            return NextResponse.json(
                { success: false, message: "Outbox entry not found." },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            data: msToMaskedOutboxRow(row),
        });
    } catch (error) {
        console.error("[mailing-studio-outbox] get-by-id error:", error);
        return NextResponse.json(
            {
                success: false,
                message: "An unexpected error occurred. Please try again later.",
            },
            { status: 500 }
        );
    }
}
