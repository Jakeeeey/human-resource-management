import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { manpowerRequestService } from "@/modules/human-resource-management/manpower-request/services/manpowerRequest.service";
import { ManpowerRequestSchema } from "@/modules/human-resource-management/manpower-request/types";

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

export async function GET() {
    try {
        const [data, departments, divisions] = await Promise.all([
            manpowerRequestService.fetchAll(),
            manpowerRequestService.fetchDepartments(),
            manpowerRequestService.fetchDivisions()
        ]);
        return NextResponse.json({ data, departments, divisions });
    } catch (e: unknown) {
        return NextResponse.json({ error: (e as Error).message }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get(COOKIE_NAME)?.value;
        const payload = token ? decodeJwtPayload(token) : null;
        const userId = payload?.id || payload?.user_id || payload?.sub;

        const body = await req.json();

        // Inject created_by
        if (userId) {
            body.requested_by = typeof userId === "string" ? parseInt(userId) : userId;
        }

        const validated = ManpowerRequestSchema.parse(body);
        const data = await manpowerRequestService.create(validated);
        return NextResponse.json(data, { status: 201 });
    } catch (e: unknown) {
        console.error("Error in POST /api/hrm/manpower_request:", e);
        return NextResponse.json({ error: (e as Error).message }, { status: 400 });
    }
}
