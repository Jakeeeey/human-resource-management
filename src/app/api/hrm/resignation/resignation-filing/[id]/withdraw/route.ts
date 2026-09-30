import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { resignationFilingService } from "@/modules/human-resource-management/resignation/resignation-filing/services/ResignationFilingService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COOKIE_NAME = "vos_access_token";

function decodeJwtPayload(token: string): Record<string, unknown> | null {
    try {
        if (!token) {
            return null;
        }
        const parts = token.split(".");
        if (parts.length < 2) {
            return null;
        }
        const segment = parts[1];
        const base64 = segment.replace(/-/g, "+").replace(/_/g, "/");
        const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
        const json = Buffer.from(padded, "base64").toString("utf8");
        return JSON.parse(json);
    } catch {
        return null;
    }
}

async function getAuthToken(): Promise<string | null> {
    const cookieStore = await cookies();
    return cookieStore.get(COOKIE_NAME)?.value || null;
}

function resolveUserId(payload: Record<string, unknown> | null): number | null {
    if (!payload) {
        return null;
    }
    const raw = payload.id ?? payload.user_id ?? payload.sub;
    if (typeof raw === "number" && Number.isFinite(raw)) {
        return raw;
    }
    if (typeof raw === "string" && raw.trim() !== "") {
        const parsed = Number(raw);
        if (Number.isFinite(parsed)) {
            return parsed;
        }
    }
    return null;
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const token = await getAuthToken();
        const payload = token ? decodeJwtPayload(token) : null;
        const userId = resolveUserId(payload);
        if (userId === null) {
            return NextResponse.json({ error: "Unauthorized: No valid token" }, { status: 401 });
        }
        const resolved = await params;
        const filingId = Number(resolved.id);
        if (!Number.isFinite(filingId)) {
            return NextResponse.json({ error: "Resignation filing not found" }, { status: 404 });
        }
        const outcome = await resignationFilingService.withdraw(filingId, userId);
        if (outcome === "withdrawn") {
            return NextResponse.json({ success: true }, { status: 200 });
        }
        if (outcome === "not_pending") {
            return NextResponse.json({ error: "Only a pending filing can be withdrawn" }, { status: 409 });
        }
        return NextResponse.json({ error: "Resignation filing not found" }, { status: 404 });
    } catch (error) {
        console.error("PATCH resignation-filing withdraw error:", error);
        return NextResponse.json({ error: "Failed to withdraw resignation filing" }, { status: 500 });
    }
}
