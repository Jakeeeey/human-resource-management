import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { resignationFilingService } from "@/modules/human-resource-management/resignation/resignation-filing/services/ResignationFilingService";
import { ResignationFormSchema } from "@/modules/human-resource-management/resignation/resignation-filing/types";
import {
    evaluateResignationEligibility,
    type ResignationEligibility,
} from "@/modules/human-resource-management/resignation/resignation-filing/cooldown";
import { nowUTC } from "@/modules/human-resource-management/resignation/resignation-filing/utils/audit";
import { formatPHT } from "@/modules/human-resource-management/resignation/resignation-filing/utils/time";

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

function toTargetUserId(value: string | null): number | null {
    if (value === null || value.trim() === "") {
        return null;
    }
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed <= 0) {
        return null;
    }
    return parsed;
}

function eligibilityMessage(eligibility: ResignationEligibility): string {
    if (eligibility.canFile) {
        return "";
    }
    if (eligibility.reason === "pending") {
        return "This employee already has a pending resignation filing under review.";
    }
    if (eligibility.reason === "approved") {
        return "This employee's resignation has already been acknowledged.";
    }
    if (eligibility.reason === "clearance_ongoing") {
        return "This employee's resignation is already in the clearance process.";
    }
    if (eligibility.reason === "cleared") {
        return "This employee's resignation has already been cleared.";
    }
    if (eligibility.reason === "cooling_down") {
        if (eligibility.nextAllowedAt) {
            return `This employee can file a new resignation on ${formatPHT(eligibility.nextAllowedAt, { includeTime: false })}.`;
        }
        return "This employee cannot file a new resignation until the cooling-off period ends.";
    }
    return "This employee cannot be filed for at this time.";
}

export async function GET(req: Request) {
    try {
        const token = await getAuthToken();
        const payload = token ? decodeJwtPayload(token) : null;
        if (resolveUserId(payload) === null) {
            return NextResponse.json({ error: "Unauthorized: No valid token" }, { status: 401 });
        }
        const targetUserId = toTargetUserId(new URL(req.url).searchParams.get("user_id"));
        if (targetUserId === null) {
            return NextResponse.json({ data: [], eligibility: null, total: 0 });
        }
        const data = await resignationFilingService.fetchByUser(targetUserId);
        const eligibility = evaluateResignationEligibility(
            data.map((row) => ({ status: row.status, reviewed_at: row.reviewed_at ?? null })),
            nowUTC()
        );
        return NextResponse.json({ data, eligibility, total: data.length });
    } catch (error) {
        console.error("GET resignation-filing error:", error);
        return NextResponse.json({ error: "Failed to fetch resignation filings" }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const token = await getAuthToken();
        const payload = token ? decodeJwtPayload(token) : null;
        const actorId = resolveUserId(payload);
        if (actorId === null) {
            return NextResponse.json({ error: "Unauthorized: No valid token" }, { status: 401 });
        }
        const body: unknown = await req.json();
        const parsed = ResignationFormSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { error: "Invalid resignation filing", issues: parsed.error.issues },
                { status: 400 }
            );
        }
        const targetUserId = parsed.data.user_id;
        const rows = await resignationFilingService.fetchByUser(targetUserId);
        const eligibility = evaluateResignationEligibility(
            rows.map((row) => ({ status: row.status, reviewed_at: row.reviewed_at ?? null })),
            nowUTC()
        );
        if (eligibility.canFile === false) {
            return NextResponse.json(
                { error: eligibilityMessage(eligibility), eligibility },
                { status: 409 }
            );
        }
        const created = await resignationFilingService.create({
            user_id: targetUserId,
            created_by: actorId,
            resignation_date: parsed.data.resignation_date,
            reason: parsed.data.reason,
            attachment_uuid: parsed.data.attachment_uuid ?? null,
            attachment_name: parsed.data.attachment_name ?? null,
            attachment_type: parsed.data.attachment_type ?? null,
            filed_at: nowUTC(),
        });
        return NextResponse.json({ success: true, data: created }, { status: 201 });
    } catch (error) {
        console.error("POST resignation-filing error:", error);
        return NextResponse.json({ error: "Failed to submit resignation" }, { status: 500 });
    }
}
