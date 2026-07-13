/* eslint-disable @typescript-eslint/no-unused-vars */
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
            const startUtc = new Date(`${startDate}T00:00:00+08:00`).toISOString();
            const endUtc = new Date(`${endDate}T23:59:59+08:00`).toISOString();
            const startStr = encodeURIComponent(startUtc);
            const endStr = encodeURIComponent(endUtc);
            filterQuery = `&filter[time_of_dispatch][_between]=${startStr},${endStr}`;
        }

        const chunkArray = (arr: any[], size: number) => {
            const chunks = [];
            for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
            return chunks;
        };

        const fetchChunked = async (urlBase: string, ids: any[], idField: string, fields: string, isString: boolean = false) => {
            if (ids.length === 0) return [];
            const chunks = chunkArray(ids, 150);
            let results: any[] = [];
            for (const chunk of chunks) {
                const encodedIds = isString ? chunk.map(id => encodeURIComponent(String(id))) : chunk;
                const res = await fetch(`${DIRECTUS_URL}${urlBase}&filter[${idField}][_in]=${encodedIds.join(",")}&fields=${fields}`, {
                    headers: { "Authorization": `Bearer ${DIRECTUS_TOKEN}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    if (data.data) results = [...results, ...data.data];
                }
            }
            return results;
        };

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

        const pdpDataRaw = (await pdpRes.json()).data || [];
        const pdpData = pdpDataRaw.map((p: any) => ({ ...p, isExtra: false }));
        const pdpIds = pdpData.map((p: any) => p.id);

        const extraPdpRes = await fetch(`${DIRECTUS_URL}/items/post_dispatch_plan_extra?limit=1000&fields=*${filterQuery}`, {
            headers: { "Authorization": `Bearer ${DIRECTUS_TOKEN}` }
        });
        const extraPdpDataRaw = extraPdpRes.ok ? (await extraPdpRes.json()).data || [] : [];
        const extraPdpData = extraPdpDataRaw.map((p: any) => ({ ...p, isExtra: true }));
        const extraPdpIds = extraPdpData.map((p: any) => p.id);

        const allPdpData = [...pdpData, ...extraPdpData];

        // 2. Fetch Staff (Drivers and Helpers)
        let staffData: any[] = [];
        if (pdpIds.length > 0) {
            const sData = await fetchChunked('/items/post_dispatch_plan_staff?limit=1000', pdpIds, 'post_dispatch_plan_id', '*,user_id.user_id,user_id.user_fname,user_id.user_lname');
            staffData = [...staffData, ...sData.map((s: any) => ({ ...s, isExtra: false }))];
        }

        if (extraPdpIds.length > 0) {
            const sData = await fetchChunked('/items/post_dispatch_plan_extra_staff?limit=1000', extraPdpIds, 'post_dispatch_plan_extra_id', '*,user_id.user_id,user_id.user_fname,user_id.user_lname');
            staffData = [...staffData, ...sData.map((s: any) => ({ ...s, post_dispatch_plan_id: s.post_dispatch_plan_extra_id, isExtra: true }))];
        }

        // Fix for missing Directus relationship on user_id (where user_id is just an integer)
        const unexpandedUserIds = [...new Set(staffData.map(s => typeof s.user_id === 'number' ? s.user_id : null).filter(Boolean))];
        let usersData: any[] = [];
        if (unexpandedUserIds.length > 0) {
            usersData = await fetchChunked('/items/user?limit=1000', unexpandedUserIds, 'user_id', 'user_id,user_fname,user_lname');
        }

        // 3. Collect IDs for related records
        const vehicleIds = [...new Set(allPdpData.map((p: any) => p.vehicle_id).filter(Boolean))];

        // 4. Fetch Vehicles
        let vehiclesData: any[] = [];
        if (vehicleIds.length > 0) {
            vehiclesData = await fetchChunked('/items/vehicles?limit=1000', vehicleIds, 'vehicle_id', 'vehicle_id,vehicle_plate,vehicle_type.type_name');
        }

        // 5. Fetch Sales Invoices -> Customers -> Areas
        let invoiceData: any[] = [];
        let customerData: any[] = [];
        let areasData: any[] = [];
        let locationsData: any[] = [];

        const pdiData = await fetchChunked('/items/post_dispatch_invoices?limit=1000', pdpIds, 'post_dispatch_plan_id', 'post_dispatch_plan_id,invoice_id');
        const invoiceIds = [...new Set(pdiData.map((i: any) => i.invoice_id).filter(Boolean))];

        if (invoiceIds.length > 0) {
            invoiceData = await fetchChunked('/items/sales_invoice?limit=1000', invoiceIds, 'invoice_id', 'invoice_id,customer_code');
            const customerCodes = [...new Set(invoiceData.map((i: any) => i.customer_code).filter(Boolean))];
            
            if (customerCodes.length > 0) {
                customerData = await fetchChunked('/items/customer?limit=1000', customerCodes, 'customer_code', 'customer_code,city,province,brgy', true);
            }

            // Fetch Areas and Locations
            const aRes = await fetch(`${DIRECTUS_URL}/items/payroll_logistics_area?limit=1000`, { headers: { "Authorization": `Bearer ${DIRECTUS_TOKEN}` } });
            if (aRes.ok) areasData = (await aRes.json()).data || [];

            const lRes = await fetch(`${DIRECTUS_URL}/items/payroll_logistics_location?limit=1000`, { headers: { "Authorization": `Bearer ${DIRECTUS_TOKEN}` } });
            if (lRes.ok) locationsData = (await lRes.json()).data || [];
        }

        // 6. Assemble the DispatchAttendance format
        const data = allPdpData.map((p: any) => {
            const allStaff = staffData.filter(s => s.post_dispatch_plan_id === p.id && s.isExtra === p.isExtra);
            
            const getStaffInfo = (s: any) => {
                const userObj = typeof s.user_id === 'object' && s.user_id !== null ? s.user_id : null;
                const userId = userObj ? userObj.user_id : s.user_id;
                
                let fname = "";
                let lname = "";
                
                if (userObj) {
                    fname = userObj.user_fname || "";
                    lname = userObj.user_lname || "";
                } else {
                    const fallbackUser = usersData.find(u => u.user_id === userId);
                    if (fallbackUser) {
                        fname = fallbackUser.user_fname || "";
                        lname = fallbackUser.user_lname || "";
                    }
                }
                const name = fname || lname ? `${fname} ${lname}`.trim() : `User ${userId}`;
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
            const driverName = driverInfo ? driverInfo.name : null;

            // Resolve Area using SQL logic equivalent
            let brgy = "", city = "", province = "", areaName = "N/A";
            let invoice: any = null;
            
            if (p.isExtra && p.area) {
                areaName = p.area;
            } else {
                const pdInvoices = pdiData.filter((pdi: any) => pdi.post_dispatch_plan_id === p.id && !p.isExtra);
                invoice = invoiceData.find(i => pdInvoices.some((pdi: any) => pdi.invoice_id === i.invoice_id));
                if (invoice) {
                    const customer = customerData.find(c => c.customer_code === invoice.customer_code);
                    if (customer) {
                        brgy = customer.brgy || "";
                        city = customer.city || "";
                        province = customer.province || "";
                        
                        const cleanString = (s: string) => s.toUpperCase().replace(/CITY OF /g, '').replace(/ CITY/g, '').replace(/\([^)]+\)/g, '').trim();
                        const cCityClean = cleanString(city);
                        const cProvClean = cleanString(province);

                        const matchedLoc = locationsData.find(l => {
                            const lCityClean = cleanString(l.city || "");
                            const lProvClean = cleanString(l.province || "");

                            if (!lCityClean && !lProvClean) return false;

                            // Exact match
                            if (cCityClean === lCityClean && cProvClean === lProvClean) return true;

                            // Flexible match
                            const cityMatch = lCityClean && cCityClean ? (cCityClean.includes(lCityClean) || lCityClean.includes(cCityClean)) : false;
                            const provMatch = lProvClean && cProvClean ? (
                                cProvClean.includes(lProvClean) || 
                                lProvClean.includes(cProvClean) ||
                                (cProvClean.includes("NCR") && lProvClean.includes("METRO MANILA")) ||
                                (cProvClean.includes("METRO MANILA") && lProvClean.includes("NCR"))
                            ) : false;

                            return cityMatch && provMatch;
                        });

                        if (matchedLoc) {
                            const matchedArea = areasData.find(a => a.area_id === matchedLoc.area_id);
                            if (matchedArea) {
                                areaName = matchedArea.area_name;
                            }
                        }
                    }
                }
            }

            // Resolve Vehicle
            const vehicle = vehiclesData.find(v => v.vehicle_id === p.vehicle_id);
            const vehicleType = vehicle?.vehicle_type?.type_name || "Unknown";

            return {
                dispatchPlanId: p.id,
                isExtra: p.isExtra,
                isNotPayroll: p.is_not_payroll === 1 || p.is_not_payroll === true,
                dispatchDocNo: p.doc_no,
                dispatchStatus: p.status || "Posted",
                deliveryStatus: "Unknown",
                timeOfDispatch: p.time_of_dispatch,
                timeOfArrival: p.time_of_arrival,
                driverId: driverInfo ? driverInfo.userId : p.driver_id,
                driverName: driverName,
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
        const { dispatchPlanId, isExtra, driverId, helperIds, timeOfDispatch, vehicleId, isNotPayroll, area } = body;

        if (!dispatchPlanId) {
            return NextResponse.json({ error: "dispatchPlanId is required" }, { status: 400 });
        }

        if (!DIRECTUS_URL) {
            return NextResponse.json({ error: "API base URL not configured" }, { status: 500 });
        }

        const pdpTable = isExtra ? "post_dispatch_plan_extra" : "post_dispatch_plan";
        const staffTable = isExtra ? "post_dispatch_plan_extra_staff" : "post_dispatch_plan_staff";
        const staffIdField = isExtra ? "post_dispatch_plan_extra_id" : "post_dispatch_plan_id";

        // Update time_of_dispatch, vehicle_id, and/or is_not_payroll if provided
        if (timeOfDispatch !== undefined || vehicleId !== undefined || isNotPayroll !== undefined || area !== undefined) {
            const updatePayload: any = {};
            if (timeOfDispatch !== undefined) updatePayload.time_of_dispatch = timeOfDispatch;
            if (vehicleId !== undefined) updatePayload.vehicle_id = vehicleId;
            if (isNotPayroll !== undefined) updatePayload.is_not_payroll = isNotPayroll;
            if (area !== undefined && isExtra) updatePayload.area = area;

            const updateRes = await fetch(`${DIRECTUS_URL}/items/${pdpTable}/${dispatchPlanId}`, {
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

        // Synchronize staff
        const staffRes = await fetch(`${DIRECTUS_URL}/items/${staffTable}?filter[${staffIdField}][_eq]=${dispatchPlanId}`, {
            headers: { "Authorization": `Bearer ${DIRECTUS_TOKEN}` }
        });
        
        if (!staffRes.ok) {
            return NextResponse.json({ error: "Failed to fetch existing staff" }, { status: staffRes.status });
        }

        const existingStaffData = await staffRes.json();
        const existingStaff: Array<{ id: number; user_id: number; role: string }> = existingStaffData.data || [];

        const targetStaff: Array<{ user_id: number; role: string }> = [];
        if (driverId) targetStaff.push({ user_id: driverId, role: "Driver" });
        if (helperIds && Array.isArray(helperIds)) {
            helperIds.forEach((id: number) => targetStaff.push({ user_id: id, role: "Helper" }));
        }

        const toDelete: number[] = [];
        const toCreate: Array<any> = [];

        const presentMap = new Set<string>();
        existingStaff.forEach(staff => {
            const isTargeted = targetStaff.some(t => t.user_id === staff.user_id && t.role === staff.role);
            if (!isTargeted) {
                toDelete.push(staff.id);
            } else {
                presentMap.add(`${staff.user_id}-${staff.role}`);
            }
        });

        targetStaff.forEach(t => {
            if (!presentMap.has(`${t.user_id}-${t.role}`)) {
                toCreate.push({ [staffIdField]: dispatchPlanId, user_id: t.user_id, role: t.role, is_present: true });
            }
        });

        if (toDelete.length > 0) {
            await fetch(`${DIRECTUS_URL}/items/${staffTable}`, {
                method: "DELETE",
                headers: { "Authorization": `Bearer ${DIRECTUS_TOKEN}`, "Content-Type": "application/json" },
                body: JSON.stringify(toDelete)
            });
        }

        if (toCreate.length > 0) {
            await fetch(`${DIRECTUS_URL}/items/${staffTable}`, {
                method: "POST",
                headers: { "Authorization": `Bearer ${DIRECTUS_TOKEN}`, "Content-Type": "application/json" },
                body: JSON.stringify(toCreate)
            });
        }

        return NextResponse.json({ success: true });

    } catch (error) {
        return NextResponse.json({ error: "Failed to update dispatch staff" }, { status: 500 });
    }
}
