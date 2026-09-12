import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { decodeJwtPayload, COOKIE_NAME } from "@/lib/auth-utils";
import { dFetch } from "@/modules/human-resource-management/shared/utils/directus";
import { toOutboxRow } from "@/modules/human-resource-management/recruitment/mailing/utils/mailMask";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/hrm/mailing/outbox/[id]
//
// Status-only single-row viewer (D17 — no resend endpoint exists on this
// path). LOGIN-GATED like the list route (user order 2026-09-08 —
// `to_email` unmasked): 401 AUTH_DENIED without a valid session.
// Unknown id answers 404 (never 500, never an empty row).

const OUTBOX_FIELDS_RENDERED =
    "id,idempotency_key,to_email,template_id,event_key,status,warnings,error,sent_at,rendered_subject,rendered_body_html";
const OUTBOX_FIELDS_FULL =
    "id,idempotency_key,to_email,template_id,event_key,status,warnings,error,sent_at";
const OUTBOX_FIELDS_BASE =
    "id,idempotency_key,to_email,template_id,event_key,status,error,sent_at";

export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const cookieStore = await cookies();
        const token: string | undefined = cookieStore.get(COOKIE_NAME)?.value;
        const payload = token ? decodeJwtPayload(token) : null;
        const raw = payload?.id || payload?.user_id || payload?.sub;
        const userId = typeof raw === "string" ? parseInt(raw, 10) : raw;
        if (!userId) {
            return NextResponse.json({ error: "AUTH_DENIED" }, { status: 401 });
        }

        const resolvedParams = await params;
        const id = resolvedParams.id;
        if (!id) {
            return NextResponse.json(
                { success: false, message: "Outbox id is required." },
                { status: 400 }
            );
        }

        // Same full+rendered → full → base degradation as the list route:
        // each retry runs only on a no-`data` answer, so a denied grant on
        // the todo-21 snapshot columns degrades instead of 404ing the row.
        const rendered = (await dFetch(
            `/items/mail_outbox/${encodeURIComponent(id)}?fields=${OUTBOX_FIELDS_RENDERED}`
        )) as { data?: Record<string, unknown> };
        let row =
            rendered?.data && typeof rendered.data === "object" ? rendered.data : null;
        if (!row) {
            const full = (await dFetch(
                `/items/mail_outbox/${encodeURIComponent(id)}?fields=${OUTBOX_FIELDS_FULL}`
            )) as { data?: Record<string, unknown> };
            row =
                full?.data && typeof full.data === "object" ? full.data : null;
        }
        if (!row) {
            const base = (await dFetch(
                `/items/mail_outbox/${encodeURIComponent(id)}?fields=${OUTBOX_FIELDS_BASE}`
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
            data: toOutboxRow(row),
        });
    } catch (error) {
        console.error("[mailing-outbox] get-by-id error:", error);
        return NextResponse.json(
            {
                success: false,
                message: "An unexpected error occurred. Please try again later.",
            },
            { status: 500 }
        );
    }
}
