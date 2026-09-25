import { NextRequest, NextResponse } from "next/server";
import {
    msEventKeyShapeSchema,
} from "@/modules/human-resource-management/mailing-studio/studio-bindings/catalog/ms-catalog.schema";
import { dFetch } from "@/modules/human-resource-management/shared/utils/directus";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Event-catalog by-key routes (P2-T3): PATCH updates a key, DELETE retires it
// (soft-delete via is_active=false — the row survives, inactive). Same
// envelope, guard, dFetch-direct and ?filter=-lookup idioms as the collection
// route. Unknown keys → 404; invalid shape → 400. event_key is immutable —
// the path key owns identity, so a differing body event_key is rejected.
// Every mutation does write-then-verify-read.

const COLLECTION = "/items/event_catalog";
const FIELDS =
    "id,event_key,label,description,module,payload_schema,payload_example,is_active,created_at,updated_at";

function validationFailed(errors: Record<string, string[]>) {
    return NextResponse.json(
        { success: false, message: "Validation failed", errors },
        { status: 400 }
    );
}

interface CatalogRow {
    id: number | string;
    event_key: string;
}

// Reads one catalog row by event_key via ?filter= (never /items/:id for a
// possibly-missing row) — null when absent, dodging Directus's
// missing-single-item 403 gotcha.
async function getCatalogRow(event_key: string): Promise<CatalogRow | null> {
    const res = (await dFetch(
        `${COLLECTION}?fields=${FIELDS}&filter[event_key][_eq]=${encodeURIComponent(event_key)}&limit=1`
    )) as { data?: CatalogRow[] };
    if (!Array.isArray(res?.data)) return null;
    return res.data[0] ?? null;
}

export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ key: string }> }
) {
    try {
        const { key } = await params;
        if (msEventKeyShapeSchema.safeParse(key).success !== true) {
            return validationFailed({ event_key: ["Invalid event key shape"] });
        }
        const row = await getCatalogRow(key);
        if (!row) {
            return NextResponse.json(
                { success: false, message: "Event key not found.", event_key: key },
                { status: 404 }
            );
        }
        return NextResponse.json({ success: true, data: row });
    } catch (error) {
        console.error("[mailing-studio-catalog] read error:", error);
        return NextResponse.json(
            { success: false, message: "An unexpected error occurred. Please try again later." },
            { status: 500 }
        );
    }
}
