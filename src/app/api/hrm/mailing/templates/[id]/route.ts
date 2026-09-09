import { NextRequest, NextResponse } from "next/server";
import { dFetch } from "@/modules/human-resource-management/shared/utils/directus";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/hrm/mailing/templates/[id] — single mail_templates row by id.
// Read-only companion to templates/route.ts (mutations live there). No Zod
// here: GET with no body, nothing to validate. Uniform envelope
// { success, data?, message? }; missing row is 404, never 500-or-empty.

const COLLECTION = "mail_templates";
const FIELDS =
    "id,template_key,template_name,subject,body_html,body_text,is_active,created_at,updated_at,updated_by";

/**
 * Fetches one mail_templates row by id.
 * @param _req - Unused request (id comes from the path).
 * @param params - Route params carrying the template id.
 * @returns 200 { success:true, data } envelope; 400 on missing id, 404 when gone.
 */
export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        if (!id) {
            return NextResponse.json(
                { success: false, message: "Template id is required" },
                { status: 400 }
            );
        }

        const res = (await dFetch(
            `/items/${COLLECTION}/${encodeURIComponent(id)}?fields=${FIELDS}`
        )) as { data?: unknown; errors?: { message?: string }[] };
        if (!res?.data) {
            const message = res?.errors?.[0]?.message ?? "Mail template not found";
            return NextResponse.json({ success: false, message }, { status: 404 });
        }
        return NextResponse.json({ success: true, data: res.data });
    } catch (error) {
        console.error("[mailing-templates] GET by id error:", error);
        return NextResponse.json(
            { success: false, message: "An unexpected error occurred. Please try again later." },
            { status: 500 }
        );
    }
}
