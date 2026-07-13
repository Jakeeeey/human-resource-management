/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { StaffPayrollSummary, DispatchDetail } from "@/modules/human-resource-management/payroll/logistics-payroll/types/logistics-payroll.schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const DIRECTUS_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
const DIRECTUS_TOKEN = process.env.DIRECTUS_STATIC_TOKEN;

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const cutoffStart = searchParams.get("cutoff_start");
        const cutoffEnd = searchParams.get("cutoff_end");

        if (!DIRECTUS_URL) {
            return NextResponse.json({ error: "API base URL not configured" }, { status: 500 });
        }

        let filterQuery = "";
        if (cutoffStart && cutoffEnd) {
            const startUtc = new Date(`${cutoffStart}T00:00:00+08:00`).toISOString();
            const endUtc = new Date(`${cutoffEnd}T23:59:59+08:00`).toISOString();
            const startStr = encodeURIComponent(startUtc);
            const endStr = encodeURIComponent(endUtc);
            filterQuery = `&filter[time_of_dispatch][_between]=${startStr},${endStr}`;
        }

        // 1. Fetch Post Dispatch Plans
        const fields = [
            "*",
            "post_dispatch_invoices.invoice_id"
        ].join(",");

        const fetchWithRetry = async (url: string, options: any, retries = 3): Promise<Response> => {
            for (let i = 0; i < retries; i++) {
                try {
                    const res = await fetch(url, { ...options, keepalive: true });
                    return res;
                } catch (error) {
                    if (i === retries - 1) throw error;
                    await new Promise(r => setTimeout(r, 500 * (i + 1)));
                }
            }
            throw new Error("Unreachable");
        };

        const pdpRes = await fetchWithRetry(`${DIRECTUS_URL}/items/post_dispatch_plan?limit=1000&fields=${fields}${filterQuery}`, {
            headers: {
                "Authorization": `Bearer ${DIRECTUS_TOKEN}`,
            }
        });

        if (!pdpRes.ok) {
            const errorText = await pdpRes.text();
            return NextResponse.json({ error: "Failed to fetch dispatch plans", details: errorText }, { status: pdpRes.status });
        }

        const pdpDataRaw = (await pdpRes.json()).data || [];
        
        const extraPdpRes = await fetchWithRetry(`${DIRECTUS_URL}/items/post_dispatch_plan_extra?limit=1000&fields=${fields}${filterQuery}`, {
            headers: { "Authorization": `Bearer ${DIRECTUS_TOKEN}` }
        });
        const extraPdpDataRaw = extraPdpRes.ok ? ((await extraPdpRes.json()).data || []) : [];
        
        // Exclude any dispatch plans that are marked as disregarded (is_not_payroll = 1 or true)
        const pdpData = [
            ...pdpDataRaw.map((p: any) => ({ ...p, isExtra: false })),
            ...extraPdpDataRaw.map((p: any) => ({ ...p, isExtra: true }))
        ];
        
        const pdpIds = pdpData.filter((p: any) => !p.isExtra).map((p: any) => p.id);
        const extraPdpIds = pdpData.filter((p: any) => p.isExtra).map((p: any) => p.id);

        const chunkArray = <T>(arr: T[], size: number): T[][] => {
            return Array.from({ length: Math.ceil(arr.length / size) }, (v, i) =>
                arr.slice(i * size, i * size + size)
            );
        };

        const fetchChunked = async (urlBase: string, ids: any[], idField: string, fields: string, isString: boolean = false) => {
            if (ids.length === 0) return [];
            const chunks = chunkArray(ids, 150);
            const results = [];
            // Run chunks sequentially to avoid socket exhaustion, but each chunk is large
            for (const chunk of chunks) {
                const joined = isString ? chunk.map(c => encodeURIComponent(c)).join(",") : chunk.join(",");
                const res = await fetchWithRetry(`${DIRECTUS_URL}${urlBase}&filter[${idField}][_in]=${joined}&fields=${fields}`, {
                    headers: { "Authorization": `Bearer ${DIRECTUS_TOKEN}` }
                });
                if (res.ok) {
                    const json = await res.json();
                    results.push(...(json.data || []));
                }
            }
            return results;
        };

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

        // 3. Fetch Post Dispatch Invoices separately
        const pdiData = pdpIds.length > 0 ? await fetchChunked('/items/post_dispatch_invoices?limit=1000', pdpIds, 'post_dispatch_plan_id', 'post_dispatch_plan_id,invoice_id') : [];

        const pddpData = pdpIds.length > 0 ? await fetchChunked('/items/post_dispatch_dispatch_plans?limit=1000', pdpIds, 'post_dispatch_plan_id', 'post_dispatch_plan_id,dispatch_plan_id') : [];
        const dpIds = [...new Set(pddpData.map((d: any) => d.dispatch_plan_id).filter(Boolean))];
        const dpData = await fetchChunked('/items/dispatch_plan?limit=1000', dpIds, 'dispatch_id', 'dispatch_id,dispatch_no');

        const invoiceIds = [...new Set(pdiData.map((i: any) => i.invoice_id).filter(Boolean))];

        // 4. Fetch Sales Invoices -> Customers -> Areas
        const invoiceData = await fetchChunked('/items/sales_invoice?limit=1000', invoiceIds, 'invoice_id', 'invoice_id,customer_code');
        
        const customerCodes = [...new Set(invoiceData.map((i: any) => i.customer_code).filter(Boolean))];
        const customerData = await fetchChunked('/items/customer?limit=1000', customerCodes, 'customer_code', 'customer_code,city,province,brgy', true);

        // Fetch small reference tables concurrently using fetchWithRetry
        const [aRes, lRes, mRes, wRes, psRes] = await Promise.all([
            fetchWithRetry(`${DIRECTUS_URL}/items/payroll_logistics_area?limit=1000`, { headers: { "Authorization": `Bearer ${DIRECTUS_TOKEN}` } }),
            fetchWithRetry(`${DIRECTUS_URL}/items/payroll_logistics_location?limit=1000`, { headers: { "Authorization": `Bearer ${DIRECTUS_TOKEN}` } }),
            fetchWithRetry(`${DIRECTUS_URL}/items/payroll_logistics_salary_matrix?limit=1000`, { headers: { "Authorization": `Bearer ${DIRECTUS_TOKEN}` } }),
            fetchWithRetry(`${DIRECTUS_URL}/items/user_wage_management?limit=1000`, { headers: { "Authorization": `Bearer ${DIRECTUS_TOKEN}` } }),
            fetchWithRetry(`${DIRECTUS_URL}/items/payroll_logistics_staff?limit=1000`, { headers: { "Authorization": `Bearer ${DIRECTUS_TOKEN}` } })
        ]);

        const areasData: any[] = aRes.ok ? (await aRes.json()).data || [] : [];
        const locationsData: any[] = lRes.ok ? (await lRes.json()).data || [] : [];
        const matrixData: any[] = mRes.ok ? (await mRes.json()).data || [] : [];
        const wageData: any[] = wRes.ok ? (await wRes.json()).data || [] : [];
        const pStaffData: any[] = psRes.ok ? (await psRes.json()).data || [] : [];

        const vehicleIds = [...new Set(pdpData.map((p: any) => p.vehicle_id).filter(Boolean))];
        const vehicleData = await fetchChunked('/items/vehicles?limit=1000', vehicleIds, 'vehicle_id', 'vehicle_id,vehicle_plate,vehicle_type.*');

        const missingUserIds = [...new Set(staffData.map(s => typeof s.user_id === 'object' && s.user_id !== null ? null : s.user_id).filter(Boolean))];
        const userData = await fetchChunked('/items/user?limit=1000', missingUserIds, 'user_id', 'user_id,user_fname,user_lname');

        // 5. Fetch approved records from payroll_other_additions
        let approvedRecords: any[] = [];
        if (cutoffStart && cutoffEnd) {
            const aprParams = new URLSearchParams();
            aprParams.set("limit", "1000");
            aprParams.set("filter[_and][0][cutoff_start][_eq]", cutoffStart);
            aprParams.set("filter[_and][1][cutoff_end][_eq]", cutoffEnd);
            
            const aprRes = await fetchWithRetry(`${DIRECTUS_URL}/items/payroll_other_additions?${aprParams.toString()}`, {
                headers: { "Authorization": `Bearer ${DIRECTUS_TOKEN}` }
            });
            if (aprRes.ok) {
                approvedRecords = (await aprRes.json()).data || [];
            }
        }

        // Process data
        const staffMap = new Map<number, StaffPayrollSummary>();

        pdpData.forEach((p: any) => {
            let areaName = "N/A";
            let matchedAreaId: number | null = null;
            let destLocationStr = "N/A";
            
            const pdInvoices = pdiData.filter(pdi => pdi.post_dispatch_plan_id === p.id && !p.isExtra);
            const invoice = invoiceData.find(i => pdInvoices.some(pdi => pdi.invoice_id === i.invoice_id));
            if (invoice) {
                const customer = customerData.find(c => c.customer_code === invoice.customer_code);
                if (customer) {
                    const cBrgy = customer.brgy || "";
                    const cCity = customer.city || "";
                    const cProv = customer.province || "";
                    destLocationStr = [cBrgy, cCity, cProv].filter(Boolean).join(", ") || "N/A";
                    
                    const cleanString = (s: string) => s.toUpperCase().replace(/CITY OF /g, '').replace(/ CITY/g, '').replace(/\([^)]+\)/g, '').trim();
                    const cCityClean = cleanString(cCity);
                    const cProvClean = cleanString(cProv);

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
                            matchedAreaId = matchedArea.area_id;
                        }
                    }
                }
            }

            // Display string: e.g. "Manila, Metro Manila (Area A)" or just the city/prov if no area matched
            const displayLocation = areaName !== "N/A" ? `${destLocationStr} (${areaName})` : destLocationStr;

            const dispatchDocNo = p.doc_no || `PDP-${p.id}`;
            const pdpVehicleId = p.vehicle_id;
            const vehicle = vehicleData.find(v => v.vehicle_id === pdpVehicleId);
            const vType = vehicle?.vehicle_type ? (typeof vehicle.vehicle_type === 'object' ? String(vehicle.vehicle_type.type_name || "") : String(vehicle.vehicle_type)) : undefined;
            const vPlate = vehicle?.vehicle_plate ? String(vehicle.vehicle_plate).trim() : undefined;

            const linkedPddp = pddpData.filter((d: any) => d.post_dispatch_plan_id === p.id && !p.isExtra);
            const linkedDps = dpData.filter((d: any) => linkedPddp.some((pddp: any) => pddp.dispatch_plan_id === d.dispatch_id));
            const linkedDispatchNos = linkedDps.map((d: any) => d.dispatch_no).join(", ");

            const allStaff = staffData.filter(s => s.post_dispatch_plan_id === p.id && s.isExtra === p.isExtra);
            allStaff.forEach(s => {
                const userObj = typeof s.user_id === 'object' && s.user_id !== null ? s.user_id : null;
                const userId = userObj ? userObj.user_id : s.user_id;
                
                if (!userId) return;

                let name = `User ${userId}`;
                if (userObj) {
                    name = `${userObj.user_fname || ''} ${userObj.user_lname || ''}`.trim();
                } else {
                    const foundUser = userData.find((u: any) => u.user_id === userId);
                    if (foundUser) {
                        name = `${foundUser.user_fname || ''} ${foundUser.user_lname || ''}`.trim();
                    }
                }
                const role = s.role || "Unknown";

                // 1. Calculate amount
                let calculatedAmount = 0;
                let foundInMatrix = false;

                // 2. Determine user's employment status
                const userWage = wageData.find(w => w.user_id === userId);
                const isRegular = userWage?.isRegularEmployee === 1;

                // Get the vehicle_type_id of the vehicle used in this dispatch
                const actualVehicleTypeId = vehicle?.vehicle_type ? (typeof vehicle.vehicle_type === 'object' ? vehicle.vehicle_type.id || vehicle.vehicle_type.type_id : vehicle.vehicle_type) : null;

                // 3. Find matching staff profile (staff_id) in payroll_logistics_staff
                let staffProfile = pStaffData.find(ps => {
                    if (ps.staff_id !== userId) return false;
                    if (ps.role !== role) return false;
                    
                    if (role === "Driver") {
                        return ps.vehicle_type_id === actualVehicleTypeId || ps.vehicle_type_id === null;
                    } 
                    
                    if (role === "Helper") {
                        const isProfileRegular = ps.employment_type?.startsWith("REGULAR");
                        if (isRegular !== isProfileRegular) return false;
                        
                        return ps.vehicle_type_id === actualVehicleTypeId || ps.vehicle_type_id === null;
                    }
                    return false;
                });

                // If multiple profiles match, prefer the one with specific vehicle_type_id over null
                if (!staffProfile) {
                    staffProfile = pStaffData.find(ps => ps.staff_id === userId && ps.role === role); // Last resort fallback
                }

                const actualStaffId = staffProfile ? staffProfile.staff_id : userId;
                
                if (matchedAreaId !== null) {
                    // Try to find exact match in matrix (matching area, staff, and specific vehicle type)
                    let matrixRow = matrixData.find(m => 
                        String(m.area_id) === String(matchedAreaId) && 
                        String(m.staff_id) === String(actualStaffId) && 
                        String(m.vehicle_type_id) === String(actualVehicleTypeId)
                    );

                    // Fallback to match where vehicle_type_id is null (applies to any vehicle)
                    if (!matrixRow) {
                        matrixRow = matrixData.find(m => 
                            String(m.area_id) === String(matchedAreaId) && 
                            String(m.staff_id) === String(actualStaffId) && 
                            (m.vehicle_type_id === null || m.vehicle_type_id === undefined)
                        );
                    }

                    if (matrixRow) {
                        calculatedAmount = Number(matrixRow.wage_amount);
                        foundInMatrix = true;
                    }
                }

                // Fallback to daily wage
                if (!foundInMatrix) {
                    const userWage = wageData.find(w => w.user_id === userId);
                    if (userWage) {
                        calculatedAmount = Number(userWage.daily_wage) || 0;
                    } else {
                        calculatedAmount = 0;
                    }
                }

                // Determine if approved
                let formattedDateStr = null;
                
                if (p.time_of_dispatch) {
                    const d = new Date(p.time_of_dispatch);
                    d.setUTCHours(d.getUTCHours() + 8); // Convert to UTC+8
                    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
                    const dd = String(d.getUTCDate()).padStart(2, '0');
                    formattedDateStr = `${mm}/${dd}`;
                }
                
                const approvedRecord = approvedRecords.find(r => {
                    const desc = r.description || "";
                    if (String(r.user_id) !== String(userId)) return false;
                    
                    if (formattedDateStr && desc.includes(formattedDateStr)) return true;
                    
                    if (desc === `Dispatch - ${dispatchDocNo}`) return true;
                    if (dispatchDocNo && dispatchDocNo.length > 4) {
                        if (desc.includes(`Dispatch - ${dispatchDocNo}`)) return true;
                        if ((dispatchDocNo.startsWith("DP-") || dispatchDocNo.startsWith("PDP-")) && desc.includes(dispatchDocNo)) return true;
                    }

                    return false;
                });

                const isDisregarded = p.is_not_payroll === 1 || p.is_not_payroll === true;
                
                const dispatchDetail: DispatchDetail = {
                    dispatchPlanId: p.id,
                    dispatchDocNo: dispatchDocNo,
                    role: role,
                    amount: calculatedAmount,
                    location: displayLocation,
                    vehiclePlate: vPlate,
                    vehicleType: vType,
                    timeOfDispatch: p.time_of_dispatch,
                    isApproved: !!approvedRecord,
                    approvedAmount: approvedRecord ? Number(approvedRecord.amount) : undefined,
                    approvedId: approvedRecord ? approvedRecord.id : undefined,
                    isDisregarded,
                    isExtra: p.isExtra,
                    linkedDispatchNos: linkedDispatchNos || undefined
                };

                if (!staffMap.has(userId)) {
                    staffMap.set(userId, {
                        staffId: userId,
                        staffName: name,
                        totalAmount: 0,
                        dispatches: []
                    });
                }

                const summary = staffMap.get(userId)!;
                
                let dateOnly = null;
                if (p.time_of_dispatch) {
                    const d = new Date(p.time_of_dispatch);
                    d.setUTCHours(d.getUTCHours() + 8); // PHT offset
                    dateOnly = d.toISOString().split('T')[0];
                }
                
                let existingDispatch = null;
                
                // Only merge regular dispatches that occur on the same day. 
                // Extra/manual dispatches are intentionally kept as separate line items.
                // We also strictly separate disregarded DPs from valid DPs so a disregarded trip doesn't "eat" and hide a valid trip.
                if (dateOnly && !p.isExtra) {
                    existingDispatch = summary.dispatches.find(d => {
                        if (d.isExtra || d.isDisregarded !== isDisregarded || !d.timeOfDispatch) return false;
                        
                        const d1 = new Date(d.timeOfDispatch);
                        d1.setUTCHours(d1.getUTCHours() + 8);
                        const dateStr1 = d1.toISOString().split('T')[0];
                        
                        return dateStr1 === dateOnly;
                    });
                }

                if (existingDispatch) {
                    // Merge into existing
                    if (!existingDispatch.dispatchDocNo.includes(dispatchDocNo)) {
                        existingDispatch.dispatchDocNo += `\n${dispatchDocNo}`;
                    }
                    if (linkedDispatchNos && (!existingDispatch.linkedDispatchNos || !existingDispatch.linkedDispatchNos.includes(linkedDispatchNos))) {
                        existingDispatch.linkedDispatchNos = existingDispatch.linkedDispatchNos 
                            ? `${existingDispatch.linkedDispatchNos}, ${linkedDispatchNos}`
                            : linkedDispatchNos;
                    }
                    if (!existingDispatch.location.includes(displayLocation)) {
                        existingDispatch.location += `\n${displayLocation}`;
                    }
                    if (calculatedAmount > existingDispatch.amount) {
                        // Only add to total amount if it's not disregarded
                        if (!existingDispatch.isDisregarded) {
                            summary.totalAmount -= existingDispatch.amount;
                            summary.totalAmount += calculatedAmount;
                        }
                        existingDispatch.amount = calculatedAmount;
                    }
                    if (approvedRecord && !existingDispatch.isApproved) {
                        existingDispatch.isApproved = true;
                        existingDispatch.approvedAmount = Number(approvedRecord.amount);
                    }
                } else {
                    if (!isDisregarded) {
                        summary.totalAmount += calculatedAmount;
                    }
                    summary.dispatches.push(dispatchDetail);
                }
            });
        });

        const staffArray = Array.from(staffMap.values());

        return NextResponse.json({
            data: staffArray
        });

    } catch (error) {
        console.error("Error fetching logistics payroll:", error);
        return NextResponse.json(
            { 
                error: "Failed to fetch logistics payroll",
                message: error instanceof Error ? error.message : "Unknown error"
            },
            { status: 500 }
        );
    }
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        
        const { user_id, amount, cutoff_start, cutoff_end, description, dispatchDocNo } = body;
        
        if (!user_id || amount === undefined || !cutoff_start || !cutoff_end || !dispatchDocNo) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        const insertData = {
            user_id,
            amount,
            cutoff_start,
            cutoff_end,
            is_logistics: 1,
            description: description || `Dispatch - ${dispatchDocNo}`
        };
        
        const res = await fetch(`${DIRECTUS_URL}/items/payroll_other_additions`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${DIRECTUS_TOKEN}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(insertData),
        });

        if (!res.ok) {
            const errorText = await res.text();
            console.error("Error inserting logistics payroll:", errorText);
            return NextResponse.json(
                { error: "Failed to create logistics payroll", details: errorText },
                { status: res.status }
            );
        }

        const json = await res.json();
        return NextResponse.json({ success: true, data: json.data }, { status: 201 });

    } catch (error) {
        console.error("Error approving logistics payroll:", error);
        return NextResponse.json(
            { error: "Failed to approve logistics payroll" },
            { status: 500 }
        );
    }
}

export async function PATCH(req: NextRequest) {
    try {
        const body = await req.json();
        
        const { id, amount } = body;
        
        if (!id || amount === undefined) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        const updateData = { amount };
        
        const res = await fetch(`${DIRECTUS_URL}/items/payroll_other_additions/${id}`, {
            method: "PATCH",
            headers: {
                "Authorization": `Bearer ${DIRECTUS_TOKEN}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(updateData),
        });

        if (!res.ok) {
            const errorText = await res.text();
            console.error("Error updating logistics payroll:", errorText);
            return NextResponse.json(
                { error: "Failed to update logistics payroll", details: errorText },
                { status: res.status }
            );
        }

        const json = await res.json();
        return NextResponse.json({ success: true, data: json.data }, { status: 200 });

    } catch (error) {
        console.error("Error updating logistics payroll:", error);
        return NextResponse.json(
            { error: "Failed to update logistics payroll" },
            { status: 500 }
        );
    }
}
