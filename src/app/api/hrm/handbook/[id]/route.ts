import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { handbookService } from "@/modules/human-resource-management/handbook/services/handbook.service";
import { handbookSchema } from "@/modules/human-resource-management/handbook/types";

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

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const resolvedParams = await params;
        const id = parseInt(resolvedParams.id, 10);
        if (isNaN(id)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

        const data = await handbookService.fetchById(id);
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
        const userId = payload?.id || payload?.user_id || payload?.sub;

        const body = await req.json();
        
        if (userId) {
            body.updated_by = typeof userId === "string" ? parseInt(userId) : userId;
        }

        // Use partial schema for updates
        const validated = handbookSchema.partial().parse(body);
        const data = await handbookService.update(id, validated);
        return NextResponse.json(data);
    } catch (e: unknown) {
        console.error("Error in PATCH /api/hrm/handbook/[id]:", e);
        return NextResponse.json({ error: (e as Error).message }, { status: 400 });
    }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const resolvedParams = await params;
        const id = parseInt(resolvedParams.id, 10);
        if (isNaN(id)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

        await handbookService.remove(id);
        return NextResponse.json({ success: true });
    } catch (e: unknown) {
        console.error("Error in DELETE /api/hrm/handbook/[id]:", e);
        return NextResponse.json({ error: (e as Error).message }, { status: 500 });
    }
}
