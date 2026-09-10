import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { decodeJwtPayload, COOKIE_NAME } from "@/lib/auth-utils";
import { dFetch } from "@/modules/human-resource-management/shared/utils/directus";
import { mailOutboxStatusSchema } from "@/modules/human-resource-management/recruitment/mailing/types/mail-outbox.schema";
import { toOutboxRow } from "@/modules/human-resource-management/recruitment/mailing/utils/mailMask";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/hrm/mailing/outbox?status=<queued|sent|failed|skipped|dry_run>
//
// Status-only outbox viewer (D17 — no resend endpoint exists on this path).
// LOGIN-GATED (user order 2026-09-08 — `to_email` now leaves this server
// UNMASKED): same cookie session gate as company-logos (401 AUTH_DENIED
// without a valid user). `warnings`/`error` echoes pass through verbatim.
// No Zod body validation: GET has no body; the `status` query value is
// validated against `mailOutboxStatusSchema` and an unknown value answers
// 400 (never 500, never an ambiguous empty 200).

const OUTBOX_FIELDS_RENDERED =
    "id,idempotency_key,to_email,template_id,event_key,status,warnings,error,sent_at,rendered_subject,rendered_body_html";
const OUTBOX_FIELDS_FULL =
    "id,idempotency_key,to_email,template_id,event_key,status,warnings,error,sent_at";
const OUTBOX_FIELDS_BASE =
    "id,idempotency_key,to_email,template_id,event_key,status,error,sent_at";

export async function GET(req: NextRequest) {
    try {
        const cookieStore = await cookies();
        const token: string | undefined = cookieStore.get(COOKIE_NAME)?.value;
        const payload = token ? decodeJwtPayload(token) : null;
        const raw = payload?.id || payload?.user_id || payload?.sub;
        const userId = typeof raw === "string" ? parseInt(raw, 10) : raw;
        if (!userId) {
            return NextResponse.json({ error: "AUTH_DENIED" }, { status: 401 });
        }

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
            data: rows.map(toOutboxRow),
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
