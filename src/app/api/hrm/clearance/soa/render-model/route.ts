import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
    buildSoaRenderModel,
    mapClearanceSoaError,
} from "@/modules/human-resource-management/clearance/soa/services/ClearanceSoaService";
import {
    authorizeClearanceRoute,
    mapClearanceRouteError,
} from "@/modules/human-resource-management/clearance/soa/server/capability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BuildSoaRenderModelSchema = z
    .object({
        request_id: z.number().int().positive(),
        company: z
            .object({
                company_name: z.string().trim().min(1).max(255),
                company_address: z.string().trim().max(500),
                logo_data_url: z.string().nullable(),
            })
            .strict(),
        ref_no: z.string().max(64).optional(),
        clearance_no: z.string().max(64).optional(),
    })
    .strict();

export async function POST(req: NextRequest) {
    try {
        const auth = await authorizeClearanceRoute(req, "canViewAllClearances");
        if ("failure" in auth) return auth.failure;
        const body: unknown = await req.json().catch(() => null);
        const parsed = BuildSoaRenderModelSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json({ success: false, message: "Invalid request" }, { status: 400 });
        }
        try {
            const model = await buildSoaRenderModel(
                parsed.data.request_id,
                {
                    company_name: parsed.data.company.company_name,
                    company_address: parsed.data.company.company_address,
                    logo_data_url: parsed.data.company.logo_data_url,
                },
                {
                    refNo: parsed.data.ref_no,
                    clearanceNo: parsed.data.clearance_no,
                }
            );
            return NextResponse.json({ success: true, data: model });
        } catch (error) {
            return (
                mapClearanceSoaError(error) ??
                NextResponse.json({ success: false, message: "Failed to build statement of account" }, { status: 500 })
            );
        }
    } catch (error) {
        return mapClearanceRouteError(error);
    }
}
