import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import {
    authorizeClearanceRouteAny,
    mapClearanceRouteError,
} from "@/modules/human-resource-management/clearance/dashboard/server/capability";
import { getClearanceDashboard } from "@/modules/human-resource-management/clearance/dashboard/server/clearanceDashboard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
    try {
        const auth = await authorizeClearanceRouteAny(req, [
            "canViewAllClearances",
            "canManageClearances",
        ]);
        if ("failure" in auth) return auth.failure;
        return NextResponse.json({ success: true, data: await getClearanceDashboard(auth.cap) });
    } catch (error) {
        return mapClearanceRouteError(error);
    }
}
