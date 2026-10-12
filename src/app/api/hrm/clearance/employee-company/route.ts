import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { dFetch } from "@/modules/human-resource-management/clearance/hub/utils/directus";
import { ensureClearanceForm } from "@/modules/human-resource-management/clearance/hub/form/services/ClearanceFormService";
import { ensureSoa } from "@/modules/human-resource-management/clearance/hub/soa/services/ClearanceSoaService";
import {
    authorizeClearanceRoute,
    mapClearanceRouteError,
} from "@/modules/human-resource-management/clearance/hub/server/capability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EmployeeCompanyQuerySchema = z
    .object({
        user_id: z.coerce.number().int().positive().optional(),
        request_id: z.coerce.number().int().positive().optional(),
    })
    .strict()
    .refine(
        (value) => (value.user_id === undefined) !== (value.request_id === undefined),
        { message: "Exactly one of user_id or request_id is required" }
    );

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

function hasErrors(body: unknown): boolean {
    if (!isRecord(body)) return false;
    return Array.isArray(body.errors) && body.errors.length > 0;
}

function toId(value: unknown): number | null {
    if (typeof value === "number" && Number.isInteger(value)) return value;
    if (typeof value === "string" && value.trim() !== "") {
        const parsed = Number(value);
        return Number.isInteger(parsed) ? parsed : null;
    }
    return null;
}

function toPositiveId(value: unknown): number | null {
    const id = toId(value);
    return id !== null && id > 0 ? id : null;
}

async function readSingleOrNull(path: string): Promise<Record<string, unknown> | null> {
    const body: unknown = await dFetch(path);
    if (!isRecord(body) || hasErrors(body)) return null;
    return isRecord(body.data) ? body.data : null;
}

async function readFirstOrNull(path: string): Promise<Record<string, unknown> | null> {
    const body: unknown = await dFetch(path);
    if (!isRecord(body) || hasErrors(body)) return null;
    const data: unknown = body.data;
    if (!Array.isArray(data) || data.length === 0) return null;
    const first: unknown = data[0];
    return isRecord(first) ? first : null;
}

export async function GET(req: NextRequest) {
    try {
        const auth = await authorizeClearanceRoute(req, "canViewAllClearances");
        if ("failure" in auth) return auth.failure;
        const parsed = EmployeeCompanyQuerySchema.safeParse(
            Object.fromEntries(req.nextUrl.searchParams.entries())
        );
        if (!parsed.success) {
            return NextResponse.json({ success: false, message: "Invalid request" }, { status: 400 });
        }
        let userId = parsed.data.user_id ?? null;
        const requestId = parsed.data.request_id ?? null;
        if (userId === null && requestId === null) {
            return NextResponse.json({ success: false, message: "Invalid request" }, { status: 400 });
        }
        if (userId === null && requestId !== null) {
            const request = await readSingleOrNull(
                `/items/clearance_request/${requestId}?fields=id,user_id`
            );
            userId = request ? toPositiveId(request.user_id) : null;
            if (userId === null) {
                return NextResponse.json({ success: false, message: "Clearance request not found" }, { status: 404 });
            }
        }
        const user = await readSingleOrNull(`/items/user/${userId}?fields=user_id,company_id`);
        if (!user) {
            return NextResponse.json({ success: false, message: "Employee not found" }, { status: 404 });
        }
        return NextResponse.json({
            success: true,
            data: { user_id: toPositiveId(user.user_id) ?? userId, company_id: toPositiveId(user.company_id) },
        });
    } catch (error) {
        return mapClearanceRouteError(error);
    }
}

const SaveEmployeeCompanySchema = z
    .object({
        request_id: z.number().int().positive(),
        company_id: z.number().int().positive(),
    })
    .strict();

export async function POST(req: NextRequest) {
    try {
        const auth = await authorizeClearanceRoute(req, "canManageClearances");
        if ("failure" in auth) return auth.failure;
        const body: unknown = await req.json().catch(() => null);
        const parsed = SaveEmployeeCompanySchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json({ success: false, message: "Invalid request" }, { status: 400 });
        }
        const request = await readSingleOrNull(
            `/items/clearance_request/${parsed.data.request_id}?fields=id,user_id`
        );
        const userId = request ? toPositiveId(request.user_id) : null;
        if (userId === null) {
            return NextResponse.json({ success: false, message: "Clearance request not found" }, { status: 404 });
        }
        const company = await readFirstOrNull(
            `/items/company_list?filter[company_id][_eq]=${parsed.data.company_id}&fields=company_id,company_code&limit=1`
        );
        if (!company || toPositiveId(company.company_id) === null) {
            return NextResponse.json({ success: false, message: "Company not found" }, { status: 404 });
        }
        const saved: unknown = await dFetch(`/items/user/${userId}?fields=user_id,company_id`, {
            method: "PATCH",
            body: JSON.stringify({ company_id: parsed.data.company_id }),
        });
        if (!isRecord(saved) || hasErrors(saved)) {
            return NextResponse.json({ success: false, message: "Failed to save the company" }, { status: 500 });
        }
        const form = await ensureClearanceForm(parsed.data.request_id, auth.cap.actorId);
        const soa = await ensureSoa(parsed.data.request_id, auth.cap.actorId);
        return NextResponse.json({
            success: true,
            data: { user_id: userId, company_id: parsed.data.company_id, form, soa },
        });
    } catch (error) {
        return mapClearanceRouteError(error);
    }
}
