import { NextRequest, NextResponse } from "next/server";
import { msOutboxStatusSchema } from "@/modules/human-resource-management/mailing-studio/studio-outbox/types/ms-outbox.schema";
import { msToOutboxRow } from "@/modules/human-resource-management/mailing-studio/studio-outbox/types/ms-outbox-row";
import { dFetch } from "@/modules/human-resource-management/shared/utils/directus";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OUTBOX_LIST_FIELDS =
    "id,idempotency_key,to_email,template_id,event_key,status,sent_at,attempts,next_attempt_at";
const OUTBOX_LIST_FIELDS_BASE =
    "id,idempotency_key,to_email,template_id,event_key,status,sent_at";

const SORT_ALLOWLIST = ["-id", "id", "-sent_at", "sent_at", "status", "-status"] as const;

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;

function clampInt(raw: string | null, fallback: number, min: number, max: number): number {
    const parsed = raw === null ? Number.NaN : Number.parseInt(raw, 10);
    if (!Number.isInteger(parsed)) return fallback;
    return Math.min(Math.max(parsed, min), max);
}

interface DirectusList {
    data?: Record<string, unknown>[];
    meta?: { filter_count?: unknown };
}

export async function GET(req: NextRequest) {
    try {
        const params = req.nextUrl.searchParams;
        const statusParam = params.get("status");
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

        const eventParam = (params.get("event_key") ?? "").trim();
        const eventFilter = eventParam
            ? `&filter[event_key][_eq]=${encodeURIComponent(eventParam)}`
            : "";

        const searchParam = (params.get("search") ?? "").trim();
        const searchFilter = searchParam
            ? ["to_email", "event_key", "idempotency_key"]
                .map(
                    (field, index) =>
                        `&filter[_or][${index}][${field}][_contains]=${encodeURIComponent(searchParam)}`,
                )
                .join("")
            : "";

        const sortParam = params.get("sort") ?? "-id";
        if (!(SORT_ALLOWLIST as readonly string[]).includes(sortParam)) {
            return NextResponse.json(
                {
                    success: false,
                    message: `Invalid sort "${sortParam}". Allowed values: ${SORT_ALLOWLIST.join(", ")}.`,
                },
                { status: 400 }
            );
        }

        const page = clampInt(params.get("page"), 1, 1, 100000);
        const limit = clampInt(params.get("limit"), DEFAULT_LIMIT, 1, MAX_LIMIT);
        const offset = (page - 1) * limit;

        const base =
            `/items/ms_outbox?fields=${OUTBOX_LIST_FIELDS}` +
            `&sort=${encodeURIComponent(sortParam)}&limit=${limit}&offset=${offset}` +
            `&meta=filter_count${statusFilter}${eventFilter}${searchFilter}`;
        const baseFallback =
            `/items/ms_outbox?fields=${OUTBOX_LIST_FIELDS_BASE}` +
            `&sort=${encodeURIComponent(sortParam)}&limit=${limit}&offset=${offset}` +
            `&meta=filter_count${statusFilter}${eventFilter}${searchFilter}`;
        const listed = (await dFetch(base)) as DirectusList;
        let rows = Array.isArray(listed?.data) ? listed.data : null;
        let total =
            typeof listed?.meta?.filter_count === "number" ? listed.meta.filter_count : null;
        if (!rows) {
            const fallback = (await dFetch(baseFallback)) as DirectusList;
            rows = Array.isArray(fallback?.data) ? fallback.data : null;
            total =
                typeof fallback?.meta?.filter_count === "number"
                    ? fallback.meta.filter_count
                    : null;
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
            data: {
                rows: rows.map(msToOutboxRow),
                total: total ?? rows.length,
                page,
                limit,
            },
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
