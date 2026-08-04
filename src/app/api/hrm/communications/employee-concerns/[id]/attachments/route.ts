import { NextResponse } from "next/server";
import { employeeConcernService } from "@/modules/human-resource-management/communications/employee-concerns/services/employee-concern";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function handleApiError(error: unknown) {
    const errorInfo = error as { message?: string };
    console.error("Employee Concern Attachments API Error:", error);
    return NextResponse.json(
        { error: errorInfo.message || "Internal Server Error" },
        { status: 500 },
    );
}

/**
 * GET /api/hrm/communications/employee-concerns/[id]/attachments
 *
 * Returns the list of attachments for a concern. `view_url` is a client-safe
 * proxy URL that streams the file through the API (the Directus static token
 * is never exposed to the browser).
 */
export async function GET(
    _request: Request,
    { params }: { params: Promise<{ id: string }> },
) {
    try {
        const { id: idStr } = await params;
        const concernId = parseInt(idStr);
        if (Number.isNaN(concernId)) {
            return NextResponse.json({ error: "Invalid concern id" }, { status: 400 });
        }

        const attachments = await employeeConcernService.fetchAttachmentsByConcernId(concernId);

        const withUrls = attachments.map((a) => ({
            ...a,
            view_url: `/api/hrm/communications/employee-concerns/${concernId}/attachments/${a.id}`,
        }));

        return NextResponse.json({ data: withUrls });
    } catch (error) {
        return handleApiError(error);
    }
}
