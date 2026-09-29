import { NextRequest, NextResponse } from "next/server";
import { dFetch } from "@/modules/human-resource-management/shared/utils/directus";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Event-catalog collection routes (P2-T3) — the §6.1 event_catalog table made
// manageable: GET lists keys (?is_active= filter), POST registers one.
// Modelled on the mailing-studio bindings collection route: same
// { success, data?, message?, errors? } envelope, same rejectSuspiciousPayload
// primitive-only guard, same Directus-direct pattern via the shared dFetch.
// Lookups use ?filter= (never /items/:id) so a missing row is an empty list.
// Every mutation does write-then-verify-read — a Directus 200 is never proof
// a write persisted. PATCH/DELETE live on catalog/[key].

const COLLECTION = "/items/event_catalog";
const FIELDS =
    "id,event_key,label,description,module,payload_schema,payload_example,is_active,created_at,updated_at";

// GET /api/hrm/mailing-studio/catalog[?is_active=...]
// Lists catalog keys ordered by event_key. An invalid filter value is a 400,
// never a silent empty list.
export async function GET(req: NextRequest) {
    try {
        const raw = req.nextUrl.searchParams.get("is_active");
        let clause = "";
        if (raw !== null) {
            const value = raw.trim().toLowerCase();
            if (value !== "true" && value !== "1" && value !== "false" && value !== "0") {
                return NextResponse.json(
                    { success: false, message: "Invalid is_active value. Expected true or false." },
                    { status: 400 }
                );
            }
            const flag = value === "true" || value === "1" ? "true" : "false";
            clause = `&filter[is_active][_eq]=${flag}`;
        }
        const res = (await dFetch(
            `${COLLECTION}?fields=${FIELDS}&sort=event_key&limit=-1${clause}`
        )) as { data?: unknown[] };
        if (!Array.isArray(res?.data)) {
            console.error("[mailing-studio-catalog] list: Directus returned no data array");
            return NextResponse.json(
                { success: false, message: "Failed to list event keys. Please try again later." },
                { status: 500 }
            );
        }
        return NextResponse.json({ success: true, data: res.data });
    } catch (error) {
        console.error("[mailing-studio-catalog] list error:", error);
        return NextResponse.json(
            { success: false, message: "An unexpected error occurred. Please try again later." },
            { status: 500 }
        );
    }
}
