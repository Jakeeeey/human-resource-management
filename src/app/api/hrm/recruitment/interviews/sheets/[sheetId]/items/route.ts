import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { interviewService } from "@/modules/human-resource-management/recruitment/interviews/services/interview.service";

export const dynamic = "force-dynamic";

const COOKIE_NAME = "vos_access_token";

function decodeJwtPayload(token: string): Record<string, unknown> | null {
    try {
        if (!token) return null;
        const parts = token.split(".");
        if (parts.length < 2) return null;
        const p = parts[1];
        const b64 = p.replace(/-/g, "+").replace(/_/g, "/");
        const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
        const json = Buffer.from(padded, "base64").toString("utf8");
        return JSON.parse(json);
    } catch {
        return null;
    }
}

/**
 * GET per-criterion score-sheet items for the InterviewDetail breakdown.
 * Read-only lookup (T8) — mirrors the T4 interviews auth pattern.
 * @param sheetId - Interview score sheet record ID.
 * @returns { data: SheetItem[] } in criterion sort order.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ sheetId: string }> }) {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get(COOKIE_NAME)?.value;
        const payload = token ? decodeJwtPayload(token) : null;
        const raw = payload?.id || payload?.user_id || payload?.sub;
        const userId = typeof raw === "string" ? parseInt(raw, 10) : raw;
        if (!userId) return NextResponse.json({ error: "AUTH_DENIED" }, { status: 401 });

        const resolvedParams = await params;
        const sheetId = parseInt(resolvedParams.sheetId, 10);
        if (isNaN(sheetId)) return NextResponse.json({ error: "VALIDATION_FAILED" }, { status: 400 });

        const data = await interviewService.fetchSheetItems(sheetId);
        return NextResponse.json({ data });
    } catch (e: unknown) {
        return NextResponse.json({ error: (e as Error).message }, { status: 500 });
    }
}
