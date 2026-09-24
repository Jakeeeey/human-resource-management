import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { manpowerRequestService } from "@/modules/human-resource-management/manpower-request/services/manpowerRequest.service";
import { ManpowerRequestSchema } from "@/modules/human-resource-management/manpower-request/types";
import { actorIdFromJwt, nowUTC, stampUpdate } from "@/lib/audit";
import type { JwtPayload } from "@/lib/auth-utils";

const COOKIE_NAME = "vos_access_token";

function decodeJwtPayload(token: string): JwtPayload | null {
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

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const resolvedParams = await params;
        const id = parseInt(resolvedParams.id, 10);
        if (isNaN(id)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

        const data = await manpowerRequestService.fetchById(id);
        if (!data) return NextResponse.json({ error: "Not Found" }, { status: 404 });

        return NextResponse.json(data);
    } catch (e: unknown) {
        return NextResponse.json({ error: (e as Error).message }, { status: 500 });
    }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const resolvedParams = await params;
        const id = parseInt(resolvedParams.id, 10);
        if (isNaN(id)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

        const cookieStore = await cookies();
        const token = cookieStore.get(COOKIE_NAME)?.value;
        const payload = token ? decodeJwtPayload(token) : null;
        const actorId = actorIdFromJwt(payload);

        const existing = await manpowerRequestService.fetchById(id);
        if (!existing) return NextResponse.json({ error: "Not Found" }, { status: 404 });
        if ((existing.status ?? "Draft") !== "Draft") {
            return NextResponse.json({ error: "Only Draft requests can be edited." }, { status: 409 });
        }

        const body = await req.json();

        const EditableSchema = ManpowerRequestSchema.omit({
            id: true,
            request_no: true,
            requesting_department_id: true,
            requested_by: true,
            created_by: true,
            created_at: true,
            recommending_approval: true,
            noted_by: true,
            approved_by: true,
            status: true,
        }).partial();
        const validated = EditableSchema.parse(stampUpdate({ ...body, updated_at: nowUTC() }, actorId));
        const data = await manpowerRequestService.update(id, validated);
        return NextResponse.json(data);
    } catch (e: unknown) {
        console.error("Error in PATCH /api/hrm/manpower_request/[id]:", e);
        return NextResponse.json({ error: (e as Error).message }, { status: 400 });
    }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const resolvedParams = await params;
        const id = parseInt(resolvedParams.id, 10);
        if (isNaN(id)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

        await manpowerRequestService.remove(id);
        return NextResponse.json({ success: true });
    } catch (e: unknown) {
        console.error("Error in DELETE /api/hrm/manpower_request/[id]:", e);
        return NextResponse.json({ error: (e as Error).message }, { status: 500 });
    }
}
