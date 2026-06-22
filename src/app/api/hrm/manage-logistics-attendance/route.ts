/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const DIRECTUS_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
const DIRECTUS_TOKEN = process.env.DIRECTUS_STATIC_TOKEN;

// Fetch directly from Directus
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const startDate = searchParams.get("startDate") || "";
        const endDate = searchParams.get("endDate") || "";

        if (!DIRECTUS_URL) {
            return NextResponse.json({ error: "API base URL not configured" }, { status: 500 });
        }

        let filterQuery = "";
        if (startDate && endDate) {
            filterQuery = `&filter[time_of_dispatch][_between]=${startDate},${endDate}T23:59:59`;
        }

        // 1. Fetch Post Dispatch Plans
        const fields = [
            "*",
            "post_dispatch_invoices.invoice_id"
        ].join(",");

        const pdpRes = await fetch(`${DIRECTUS_URL}/items/post_dispatch_plan?limit=1000&fields=${fields}${filterQuery}`, {
            headers: {
                "Authorization": `Bearer ${DIRECTUS_TOKEN}`,
            }
        });

        if (!pdpRes.ok) {
            const errorText = await pdpRes.text();
            return NextResponse.json({ error: "Failed to fetch dispatch plans", details: errorText }, { status: pdpRes.status });
        }

        const pdpData = (await pdpRes.json()).data || [];
        const pdpIds = pdpData.map((p: any) => p.id);

        // 2. Fetch Staff (Drivers and Helpers)
        let staffData: any[] = [];
        if (pdpIds.length > 0) {
            const staffRes = await fetch(`${DIRECTUS_URL}/items/post_dispatch_plan_staff?limit=5000&filter[post_dispatch_plan_id][_in]=${pdpIds.join(",")}&fields=*,user_id.user_id,user_id.user_fname,user_id.user_lname`, {
                headers: { "Authorization": `Bearer ${DIRECTUS_TOKEN}` }
            });
            if (staffRes.ok) {
                staffData = (await staffRes.json()).data || [];
            }
        }

        // 3. Collect IDs for related records
        const vehicleIds = [...new Set(pdpData.map((p: any) => p.vehicle_id).filter(Boolean))];
        const invoiceIds = [...new Set(pdpData.flatMap((p: any) => p.post_dispatch_invoices?.map((i: any) => i.invoice_id)).filter(Boolean))];

        // 4. Fetch Vehicles
        let vehiclesData: any[] = [];
        if (vehicleIds.length > 0) {
            const vRes = await fetch(`${DIRECTUS_URL}/items/vehicles?limit=1000&filter[vehicle_id][_in]=${vehicleIds.join(",")}&fields=vehicle_id,vehicle_plate,vehicle_type.type_name`, {
                headers: { "Authorization": `Bearer ${DIRECTUS_TOKEN}` }
            });
            if (vRes.ok) vehiclesData = (await vRes.json()).data || [];
        }

        // 5. Fetch Sales Invoices -> Customers -> Areas
        let invoiceData: any[] = [];
        let customerData: any[] = [];
        let areasData: any[] = [];
        let locationsData: any[] = [];

        if (invoiceIds.length > 0) {
            const siRes = await fetch(`${DIRECTUS_URL}/items/sales_invoice?limit=1000&filter[invoice_id][_in]=${invoiceIds.join(",")}&fields=invoice_id,customer_code`, {
                headers: { "Authorization": `Bearer ${DIRECTUS_TOKEN}` }
            });
            if (siRes.ok) invoiceData = (await siRes.json()).data || [];

            const customerCodes = [...new Set(invoiceData.map((i: any) => i.customer_code).filter(Boolean))];
            
            // Note: Since customer_code is a string, we map over them and encode properly
            if (customerCodes.length > 0) {
                // Avoid URL too long error by taking a chunk, or just fetching all and filtering in memory.
                // Fetching all customers might be heavy, let's filter by the specific codes.
                // We'll join them into a valid query string
                const cQuery = customerCodes.map(c => encodeURIComponent(c)).join(",");
                const cRes = await fetch(`${DIRECTUS_URL}/items/customer?limit=1000&filter[customer_code][_in]=${cQuery}&fields=customer_code,city,province,brgy`, {
                    headers: { "Authorization": `Bearer ${DIRECTUS_TOKEN}` }
                });
                if (cRes.ok) customerData = (await cRes.json()).data || [];
            }

            // Fetch Areas and Locations
            const aRes = await fetch(`${DIRECTUS_URL}/items/payroll_logistics_area?limit=1000`, { headers: { "Authorization": `Bearer ${DIRECTUS_TOKEN}` } });
            if (aRes.ok) areasData = (await aRes.json()).data || [];

            const lRes = await fetch(`${DIRECTUS_URL}/items/payroll_logistics_location?limit=1000`, { headers: { "Authorization": `Bearer ${DIRECTUS_TOKEN}` } });
            if (lRes.ok) locationsData = (await lRes.json()).data || [];
        }

        // 6. Assemble the DispatchAttendance format
        const data = pdpData.map((p: any) => {
            const allStaff = staffData.filter(s => s.post_dispatch_plan_id === p.id);
            
            const getStaffInfo = (s: any) => {
                const userObj = typeof s.user_id === 'object' && s.user_id !== null ? s.user_id : null;
                const userId = userObj ? userObj.user_id : s.user_id;
                const name = userObj ? `${userObj.user_fname || ''} ${userObj.user_lname || ''}`.trim() : `User ${userId}`;
                return { userId, name, isPresent: s.is_present === 1 || s.is_present === true, role: s.role };
            };

            const helperRecords = allStaff.filter(s => s.role === 'Helper');
            const staff = helperRecords.map(s => {
                const info = getStaffInfo(s);
                return {
                    staffUserId: info.userId || null,
                    staffName: info.name || "Unknown",
                    staffRole: info.role || "Unknown",
                    status: info.isPresent ? "Present" : "Absent",
                    isPresent: info.isPresent
                };
            });

            const driverRecord = allStaff.find(s => s.role === 'Driver');
            const driverInfo = driverRecord ? getStaffInfo(driverRecord) : null;

            // Resolve Area using SQL logic equivalent
            let brgy = "", city = "", province = "", areaName = "N/A";
            
            const invoice = invoiceData.find(i => p.post_dispatch_invoices?.some((pdi: any) => pdi.invoice_id === i.invoice_id));
            if (invoice) {
                const customer = customerData.find(c => c.customer_code === invoice.customer_code);
                if (customer) {
                    brgy = customer.brgy || "";
                    city = customer.city || "";
                    province = customer.province || "";
                    
                    // Match location exactly like view_logistics_payroll SQL
                    const cCityClean = city.toUpperCase().replace(/CITY OF /g, '').replace(/ CITY/g, '').replace(/\(CAPITAL\)/g, '').trim();
                    const cProvClean = province.toUpperCase().trim();

                    const matchedLoc = locationsData.find(l => {
                        const lCityClean = (l.city || "").toUpperCase().replace(/CITY OF /g, '').replace(/ CITY/g, '').replace(/\(CAPITAL\)/g, '').trim();
                        const lProvClean = (l.province || "").toUpperCase().trim();
                        return cCityClean === lCityClean && cProvClean === lProvClean;
                    });

                    if (matchedLoc) {
                        const matchedArea = areasData.find(a => a.area_id === matchedLoc.area_id);
                        if (matchedArea) {
                            areaName = matchedArea.area_name;
                        }
                    }
                }
            }

            // Resolve Vehicle
            const vehicle = vehiclesData.find(v => v.vehicle_id === p.vehicle_id);
            const vehicleType = vehicle?.vehicle_type?.type_name || "Unknown";

            return {
                dispatchPlanId: p.id,
                dispatchDocNo: p.doc_no,
                dispatchStatus: p.status,
                deliveryStatus: "Unknown",
                timeOfDispatch: p.time_of_dispatch,
                timeOfArrival: p.time_of_arrival,
                driverId: driverInfo ? driverInfo.userId : p.driver_id,
                driverName: driverInfo ? driverInfo.name : null,
                vehicleId: p.vehicle_id,
                vehicleType,
                invoiceId: invoice?.invoice_id || null,
                invoiceNo: "",
                totalAmount: p.amount,
                salesOrderNo: "",
                customerCode: invoice?.customer_code || "",
                customerName: "",
                storeName: "",
                brgy,
                city,
                province,
                areaName,
                staff: staff,
            };
        });

        return NextResponse.json({
            data,
            meta: {
                startDate,
                endDate,
                totalDispatches: data.length,
                totalStaff: staffData.length,
                presentCount: staffData.filter(s => s.is_present).length,
                absentCount: staffData.filter(s => !s.is_present).length,
            }
        });

    } catch (error) {
        return NextResponse.json(
            { error: "Failed to load logistics attendance", details: error instanceof Error ? error.message : "Unknown error" },
            { status: 500 }
        );
    }
}

// Handle updates to Driver and Helpers
export async function PATCH(request: NextRequest) {
    try {
        const body = await request.json();
        const { dispatchPlanId, driverId, helperIds, timeOfDispatch, vehicleId } = body;

        if (!dispatchPlanId) {
            return NextResponse.json({ error: "dispatchPlanId is required" }, { status: 400 });
        }

        if (!DIRECTUS_URL) {
            return NextResponse.json({ error: "API base URL not configured" }, { status: 500 });
        }

        // Update time_of_dispatch and/or vehicle_id if provided
        if (timeOfDispatch !== undefined || vehicleId !== undefined) {
            const updatePayload: any = {};
            if (timeOfDispatch !== undefined) updatePayload.time_of_dispatch = timeOfDispatch;
            if (vehicleId !== undefined) updatePayload.vehicle_id = vehicleId;

            const updateRes = await fetch(`${DIRECTUS_URL}/items/post_dispatch_plan/${dispatchPlanId}`, {
                method: "PATCH",
                headers: {
                    "Authorization": `Bearer ${DIRECTUS_TOKEN}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(updatePayload)
            });
            if (!updateRes.ok) {
                console.error("Failed to update pdp", await updateRes.text());
            }
        }

        // Synchronize post_dispatch_plan_staff
        // Fetch existing staff for this PDP
        const staffRes = await fetch(`${DIRECTUS_URL}/items/post_dispatch_plan_staff?filter[post_dispatch_plan_id][_eq]=${dispatchPlanId}`, {
            headers: {
                "Authorization": `Bearer ${DIRECTUS_TOKEN}`
            }
        });
        
        if (!staffRes.ok) {
            return NextResponse.json({ error: "Failed to fetch existing staff" }, { status: staffRes.status });
        }

        const existingStaffData = await staffRes.json();
        const existingStaff: Array<{ id: number; user_id: number; role: string }> = existingStaffData.data || [];

        // We want the final state to be: 1 Driver (driverId), N Helpers (helperIds)
        const targetStaff: Array<{ user_id: number; role: string }> = [];
        if (driverId) targetStaff.push({ user_id: driverId, role: "Driver" });
        if (helperIds && Array.isArray(helperIds)) {
            helperIds.forEach((id: number) => targetStaff.push({ user_id: id, role: "Helper" }));
        }

        const toDelete: number[] = [];
        const toCreate: Array<{ post_dispatch_plan_id: number; user_id: number; role: string }> = [];

        // Determine what to delete and what is already present
        const presentMap = new Set<string>(); // "user_id-role"
        existingStaff.forEach(staff => {
            const isTargeted = targetStaff.some(t => t.user_id === staff.user_id && t.role === staff.role);
            if (!isTargeted) {
                toDelete.push(staff.id);
            } else {
                presentMap.add(`${staff.user_id}-${staff.role}`);
            }
        });

        // Determine what to create
        targetStaff.forEach(t => {
            if (!presentMap.has(`${t.user_id}-${t.role}`)) {
                toCreate.push({ post_dispatch_plan_id: dispatchPlanId, user_id: t.user_id, role: t.role });
            }
        });

        // Perform deletions
        if (toDelete.length > 0) {
            await fetch(`${DIRECTUS_URL}/items/post_dispatch_plan_staff`, {
                method: "DELETE",
                headers: {
                    "Authorization": `Bearer ${DIRECTUS_TOKEN}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(toDelete)
            });
        }

        // Perform creations
        if (toCreate.length > 0) {
            await fetch(`${DIRECTUS_URL}/items/post_dispatch_plan_staff`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${DIRECTUS_TOKEN}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(toCreate)
            });
        }

        return NextResponse.json({ success: true });

    } catch (error) {
        return NextResponse.json(
            { error: "Failed to update dispatch staff", details: error instanceof Error ? error.message : "Unknown error" },
            { status: 500 }
        );
    }
}
