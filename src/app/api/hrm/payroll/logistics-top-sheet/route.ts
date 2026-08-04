import { NextRequest, NextResponse } from "next/server";
import { LogisticsTopSheetItem } from "@/modules/human-resource-management/payroll/logistics-top-sheet/types/logistics-top-sheet.schema";

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

        if (!cutoffStart || !cutoffEnd) {
            return NextResponse.json({ error: "Missing cutoff dates" }, { status: 400 });
        }

        const fetchWithRetry = async (url: string, options: RequestInit, retries = 3): Promise<Response> => {
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

        const chunkArray = <T>(arr: T[], size: number): T[][] => {
            return Array.from({ length: Math.ceil(arr.length / size) }, (v, i) =>
                arr.slice(i * size, i * size + size)
            );
        };

        // 1. Fetch POSTED payroll runs for the given cutoff
        const prParams = new URLSearchParams();
        prParams.set("limit", "1000");
        prParams.set("filter[_and][0][cutoff_start][_eq]", cutoffStart);
        prParams.set("filter[_and][1][cutoff_end][_eq]", cutoffEnd);
        prParams.set("filter[_and][2][status][_eq]", "POSTED");

        const prRes = await fetchWithRetry(`${DIRECTUS_URL}/items/payroll_run?${prParams.toString()}`, {
            headers: { "Authorization": `Bearer ${DIRECTUS_TOKEN}` }
        });

        if (!prRes.ok) {
            return NextResponse.json({ error: "Failed to fetch payroll runs", details: await prRes.text() }, { status: prRes.status });
        }

        const prData = (await prRes.json()).data || [];
        if (prData.length === 0) {
            // No posted payroll runs for this cutoff
            return NextResponse.json({ data: [] });
        }

        const postedRunIds = prData.map((r: { payroll_run_id: number }) => r.payroll_run_id);

        // 2. Fetch payroll_run_employee records for these POSTED runs
        interface PayrollRunEmployee {
            id?: number | string;
            user_id?: number | string;
            department_name_snapshot?: string;
            department_name?: string;
            employee_name?: string;
            is_card?: boolean;
            gross_pay?: number | string;
            total_additions?: number | string;
            total_deductions?: number | string;
            net_pay?: number | string;
        }
        const preData: PayrollRunEmployee[] = [];
        const preChunks = chunkArray(postedRunIds, 150);
        for (const chunk of preChunks) {
            const joined = chunk.join(",");
            const preRes = await fetchWithRetry(`${DIRECTUS_URL}/items/payroll_run_employee?filter[payroll_run_id][_in]=${joined}&limit=1000`, {
                headers: { "Authorization": `Bearer ${DIRECTUS_TOKEN}` }
            });
            if (preRes.ok) {
                const json = await preRes.json();
                preData.push(...(json.data || []));
            }
        }

        if (preData.length === 0) {
            return NextResponse.json({ data: [] });
        }

        // 3. Fetch logistics additions for the breakdown (additionsList)
        const aprParams = new URLSearchParams();
        aprParams.set("limit", "1000");
        aprParams.set("filter[_and][0][cutoff_start][_eq]", cutoffStart);
        aprParams.set("filter[_and][1][cutoff_end][_eq]", cutoffEnd);
        
        const aprRes = await fetchWithRetry(`${DIRECTUS_URL}/items/payroll_other_additions?${aprParams.toString()}`, {
            headers: { "Authorization": `Bearer ${DIRECTUS_TOKEN}` }
        });

        const additionsData = aprRes.ok ? ((await aprRes.json()).data || []) : [];
        const userAdditionsList = new Map<number, {description: string, amount: number}[]>();
        
        additionsData.forEach((a: { description?: string; user_id?: string | number; amount?: string | number }) => {
            const desc = a.description || "";
            const isLogisticsRecord = desc.startsWith("Dispatch -") || desc.includes("Helper") || desc.includes("Driver") || /^\d{2}[/-]\d{2}/.test(desc);
            
            if (isLogisticsRecord) {
                const userId = Number(a.user_id);
                const amount = Number(a.amount) || 0;
                
                if (!userAdditionsList.has(userId)) {
                    userAdditionsList.set(userId, []);
                }
                userAdditionsList.get(userId)!.push({
                    description: desc,
                    amount: amount
                });
            }
        });

        // 4. Identify Logistics Employees
        // We include employees who either:
        // - Have logistics additions in this cutoff
        // - Belong to the Logistics department in the payroll run
        const logisticsEmployees = preData.filter(pre => {
            const userId = Number(pre.user_id);
            const deptName = (pre.department_name_snapshot || pre.department_name || "").toLowerCase();
            const hasLogisticsAdditions = userAdditionsList.has(userId);
            const isLogisticsDept = deptName.includes("logistic");
            
            return hasLogisticsAdditions || isLogisticsDept;
        });

        if (logisticsEmployees.length === 0) {
            return NextResponse.json({ data: [] });
        }

        const userIdsToFetch = Array.from(new Set(logisticsEmployees.map(pre => Number(pre.user_id))));

        // 5. Fetch user details (for external_id)
        const userData: { user_id?: number; user_fname?: string; user_lname?: string; user_mname?: string; external_id?: string | number }[] = [];
        const userChunks = chunkArray(userIdsToFetch, 150);
        for (const chunk of userChunks) {
            const joined = chunk.join(",");
            const res = await fetchWithRetry(`${DIRECTUS_URL}/items/user?filter[user_id][_in]=${joined}&fields=user_id,user_fname,user_lname,user_mname,external_id`, {
                headers: { "Authorization": `Bearer ${DIRECTUS_TOKEN}` }
            });
            if (res.ok) {
                const json = await res.json();
                userData.push(...(json.data || []));
            }
        }

        // 6. Map to Top Sheet Items
        const topSheetData: LogisticsTopSheetItem[] = logisticsEmployees.map(pre => {
            const userId = Number(pre.user_id);
            const user = userData.find(u => u.user_id === userId);
            
            let empName = pre.employee_name || `Unknown User (${userId})`;
            if (user && !pre.employee_name) {
                const last = user.user_lname || "";
                const first = user.user_fname || "";
                const middle = user.user_mname || "";
                empName = `${last}, ${first} ${middle}`.trim().replace(/ ,/g, ",");
            }

            const empId = user?.external_id ? String(user.external_id) : String(userId).padStart(4, '0');

            return {
                id: String(pre.id || userId),
                userId: userId,
                employeeId: empId,
                employeeName: empName,
                type: pre.is_card ? "CARD" : "CASH",
                grossPay: Number(pre.gross_pay) || 0,
                additions: Number(pre.total_additions) || 0,
                deductions: Number(pre.total_deductions) || 0,
                netPay: Number(pre.net_pay) || 0,
                additionsList: userAdditionsList.get(userId) || []
            };
        });

        // Filter out employees with absolutely no amounts
        const filteredTopSheetData = topSheetData.filter(item => 
            item.grossPay !== 0 || item.additions !== 0 || item.deductions !== 0 || item.netPay !== 0
        );

        // Sort by employee name alphabetically
        filteredTopSheetData.sort((a, b) => a.employeeName.localeCompare(b.employeeName));

        return NextResponse.json({ data: filteredTopSheetData });

    } catch (error) {
        console.error("Error fetching logistics top sheet:", error);
        return NextResponse.json(
            { 
                error: "Failed to fetch logistics top sheet",
                message: error instanceof Error ? error.message : "Unknown error"
            },
            { status: 500 }
        );
    }
}
