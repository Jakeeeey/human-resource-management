/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DIRECTUS_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
const DIRECTUS_TOKEN = process.env.DIRECTUS_STATIC_TOKEN;

// Handle creating manual PDPs
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { docNo, driverId, helperIds, timeOfDispatch, vehicleId } = body;

        if (!docNo || !timeOfDispatch) {
            return NextResponse.json({ error: "docNo and timeOfDispatch are required" }, { status: 400 });
        }

        if (!DIRECTUS_URL) {
            return NextResponse.json({ error: "API base URL not configured" }, { status: 500 });
        }

        const pdpPayload: any = {
            doc_no: docNo,
            time_of_dispatch: timeOfDispatch,
            status: "Posted"
        };
        if (driverId) pdpPayload.driver_id = driverId;
        if (vehicleId) pdpPayload.vehicle_id = vehicleId;

        const pdpRes = await fetch(`${DIRECTUS_URL}/items/post_dispatch_plan_extra`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${DIRECTUS_TOKEN}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(pdpPayload)
        });

        if (!pdpRes.ok) {
            const errorText = await pdpRes.text();
            console.error("Failed to create manual pdp", errorText);
            return NextResponse.json({ error: "Failed to create manual PDP", details: errorText }, { status: pdpRes.status });
        }

        const pdpData = await pdpRes.json();
        const newPdpId = pdpData.data.id;

        const staffToCreate: Array<any> = [];
        if (driverId) staffToCreate.push({ post_dispatch_plan_extra_id: newPdpId, user_id: driverId, role: "Driver", is_present: true });
        if (helperIds && Array.isArray(helperIds)) {
            helperIds.forEach((id: number) => {
                staffToCreate.push({ post_dispatch_plan_extra_id: newPdpId, user_id: id, role: "Helper", is_present: true });
            });
        }

        if (staffToCreate.length > 0) {
            await fetch(`${DIRECTUS_URL}/items/post_dispatch_plan_extra_staff`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${DIRECTUS_TOKEN}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(staffToCreate)
            });
        }

        return NextResponse.json({ success: true, data: pdpData.data });
    } catch (error) {
        return NextResponse.json({ error: "Failed to create manual PDP" }, { status: 500 });
    }
}
