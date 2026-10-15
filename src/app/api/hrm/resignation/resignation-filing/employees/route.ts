import { NextResponse } from "next/server";
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

export async function GET() {
    try {
        const token = await getAuthToken();
        const payload = token ? decodeJwtPayload(token) : null;
        if (resolveUserId(payload) === null) {
            return NextResponse.json({ error: "Unauthorized: No valid token" }, { status: 401 });
        }
        const data = await resignationFilingService.fetchEmployees();
        return NextResponse.json({ data });
    } catch (error) {
        console.error("GET resignation-filing employees error:", error);
        return NextResponse.json({ error: "Failed to fetch employees" }, { status: 500 });
    }
}
