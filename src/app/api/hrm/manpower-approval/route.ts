import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { manpowerApprovalService } from "@/modules/human-resource-management/employee-admin/manpower-approval/services/manpowerApproval.service";

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
        const [data, departments, divisions, users] = await Promise.all([
            manpowerApprovalService.fetchDraftRequests(),
            manpowerApprovalService.fetchDepartments(),
            manpowerApprovalService.fetchDivisions(),
            manpowerApprovalService.fetchUsers()
        ]);
        
        return NextResponse.json({ data, departments, divisions, users });
    } catch (e: unknown) {
        return NextResponse.json({ error: (e as Error).message }, { status: 500 });
    }
}

export async function PATCH(req: NextRequest) {
    try {
        const body = await req.json();
        const { id, status } = body;
        
        if (!id || !status) {
            return NextResponse.json({ error: "Missing id or status" }, { status: 400 });
        }

        const cookieStore = await cookies();
        const token = cookieStore.get(COOKIE_NAME)?.value;
        const payload = token ? decodeJwtPayload(token) : null;
        const userId = payload?.id || payload?.user_id || payload?.sub;

        const updated = await manpowerApprovalService.updateStatus(id, status, userId as number | undefined);
        return NextResponse.json({ data: updated });
    } catch (e: unknown) {
        return NextResponse.json({ error: (e as Error).message }, { status: 500 });
    }
}
