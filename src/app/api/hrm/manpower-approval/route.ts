import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { manpowerApprovalService } from "@/modules/human-resource-management/employee-admin/manpower-approval/services/manpowerApproval.service";
import { decodeJwtPayload, COOKIE_NAME } from "@/lib/auth-utils";
import { actorIdFromJwt } from "@/modules/human-resource-management/shared/utils/audit";

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
        const actorId = actorIdFromJwt(payload);

        const updated = await manpowerApprovalService.updateStatus(id, status, actorId ?? undefined);
        return NextResponse.json({ data: updated });
    } catch (e: unknown) {
        return NextResponse.json({ error: (e as Error).message }, { status: 500 });
    }
}
