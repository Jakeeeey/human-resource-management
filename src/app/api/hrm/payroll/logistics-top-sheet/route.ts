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

        const aprParams = new URLSearchParams();
        aprParams.set("limit", "1000");
        aprParams.set("filter[_and][0][cutoff_start][_eq]", cutoffStart);
        aprParams.set("filter[_and][1][cutoff_end][_eq]", cutoffEnd);
        
        const aprRes = await fetchWithRetry(`${DIRECTUS_URL}/items/payroll_other_additions?${aprParams.toString()}`, {
            headers: { "Authorization": `Bearer ${DIRECTUS_TOKEN}` }
        });

        if (!aprRes.ok) {
            const errorText = await aprRes.text();
            return NextResponse.json({ error: "Failed to fetch payroll additions", details: errorText }, { status: aprRes.status });
        }

        const additionsData = (await aprRes.json()).data || [];

        if (additionsData.length === 0) {
            return NextResponse.json({ data: [] });
        }

        // 2. Group by user_id
        const userAdditions = new Map<number, number>();
        const userAdditionsList = new Map<number, {description: string, amount: number}[]>();
        
        additionsData.forEach((a: { description?: string; user_id?: string | number; amount?: string | number }) => {
            const desc = a.description || "";
            const isLogisticsRecord = desc.startsWith("Dispatch -") || desc.includes("Helper") || desc.includes("Driver") || /^\d{2}[/-]\d{2}/.test(desc);
            
            if (isLogisticsRecord) {
                const userId = Number(a.user_id);
                const amount = Number(a.amount) || 0;
                
                // Add to total
                if (userAdditions.has(userId)) {
                    userAdditions.set(userId, userAdditions.get(userId)! + amount);
                } else {
                    userAdditions.set(userId, amount);
                }

                // Add to detailed list
                if (!userAdditionsList.has(userId)) {
                    userAdditionsList.set(userId, []);
                }
                userAdditionsList.get(userId)!.push({
                    description: desc,
                    amount: amount
                });
            }
        });

        const userIds = Array.from(userAdditions.keys());

        if (userIds.length === 0) {
            return NextResponse.json({ data: [] });
        }

        // 3. Fetch user details
        const chunkArray = <T>(arr: T[], size: number): T[][] => {
            return Array.from({ length: Math.ceil(arr.length / size) }, (v, i) =>
                arr.slice(i * size, i * size + size)
            );
        };

        const userData: { user_id?: number; user_fname?: string; user_lname?: string; user_mname?: string; external_id?: string | number }[] = [];
        const chunks = chunkArray(userIds, 150);
        for (const chunk of chunks) {
            const joined = chunk.join(",");
            const res = await fetchWithRetry(`${DIRECTUS_URL}/items/user?filter[user_id][_in]=${joined}&fields=user_id,user_fname,user_lname,user_mname,external_id`, {
                headers: { "Authorization": `Bearer ${DIRECTUS_TOKEN}` }
            });
            if (res.ok) {
                const json = await res.json();
                userData.push(...(json.data || []));
            }
        }

        // 4. Map to Top Sheet Items
        const topSheetData: LogisticsTopSheetItem[] = userIds.map(userId => {
            const user = userData.find(u => u.user_id === userId);
            
            // Format name (Lastname, Firstname Middlename)
            let empName = `Unknown User (${userId})`;
            if (user) {
                const last = user.user_lname || "";
                const first = user.user_fname || "";
                const middle = user.user_mname || "";
                empName = `${last}, ${first} ${middle}`.trim().replace(/ ,/g, ",");
            }

            const empId = user?.external_id ? String(user.external_id) : String(userId).padStart(4, '0');
            const additions = userAdditions.get(userId) || 0;

            return {
                id: String(userId),
                userId: userId,
                employeeId: empId,
                employeeName: empName,
                type: "CASH",
                grossPay: 0,
                additions: additions,
                deductions: 0,
                netPay: additions, // Gross + Additions - Deductions
                additionsList: userAdditionsList.get(userId) || []
            };
        });

        // Sort by employee name alphabetically
        topSheetData.sort((a, b) => a.employeeName.localeCompare(b.employeeName));

        return NextResponse.json({ data: topSheetData });

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
