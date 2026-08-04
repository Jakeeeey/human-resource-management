import { NextRequest, NextResponse } from "next/server";
import { SalesmanDraft, User, Division, Branch, Operation, PriceType } from "@/modules/human-resource-management/employee-admin/sales-management/salesman-approval/types";

const DIRECTUS_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
const DIRECTUS_TOKEN = process.env.DIRECTUS_STATIC_TOKEN;

if (!DIRECTUS_URL) {
    throw new Error("NEXT_PUBLIC_API_BASE_URL is not defined in environment variables");
}

export const dynamic = "force-dynamic";
export const revalidate = 0;

const LIMIT = 1000;

interface DirectusResponse<T> {
    data: T[];
}

async function fetchAll<T>(collection: string, filter?: string): Promise<T[]> {
    const filterQuery = filter ? `&filter=${encodeURIComponent(filter)}` : "";
    const url = `${DIRECTUS_URL}/items/${collection}?limit=${LIMIT}${filterQuery}`;
    
    const res = await fetch(url, {
        cache: "no-store",
        headers: {
            "Authorization": `Bearer ${DIRECTUS_TOKEN}`,
            "Content-Type": "application/json"
        }
    });

    if (!res.ok) {
        const text = await res.text();
        console.error(`DIRECTUS ERROR [${url}]:`, text);
        throw new Error(`Directus error ${collection}: ${res.status}`);
    }

    const json: DirectusResponse<T> = await res.json();
    return json.data || [];
}

async function getCurrentTimeInTimeZone() {
    try {
        const search = new URLSearchParams();
        search.set("filter[setting_key][_eq]", "time_zone");
        const url = `${DIRECTUS_URL}/items/general_setting?${search.toString()}`;
        
        const res = await fetch(url, {
            headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` },
            cache: "no-store",
        });
        
        if (!res.ok) throw new Error("Failed to fetch timezone setting");
        
        const json = await res.json();
        const timeZone = json.data?.[0]?.setting_value || "Asia/Manila";
        
        const now = new Date();
        const formatter = new Intl.DateTimeFormat("sv-SE", {
            timeZone,
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: false,
        });
        
        const parts = formatter.formatToParts(now);
        const map: Record<string, string> = {};
        parts.forEach(p => map[p.type] = p.value);
        
        return `${map.year}-${map.month}-${map.day} ${map.hour}:${map.minute}:${map.second}`;
    } catch (e) {
        console.error("Error fetching timezone:", e);
        const now = new Date();
        return now.toLocaleString("sv-SE", { timeZone: "Asia/Manila" }).replace("T", " ");
    }
}

async function findSalesmanConflict(params: {
    employeeId?: number;
    salesmanCode?: string;
    salesmanName?: string;
    truckPlate?: string;
    excludeId?: number;
}): Promise<SalesmanDraft | null> {
    const { employeeId, salesmanCode, salesmanName, truckPlate, excludeId } = params;
    if (!employeeId && !salesmanCode && !salesmanName && !truckPlate) return null;

    const checkCollection = async (collection: string) => {
        const search = new URLSearchParams();
        search.set("limit", "1");

        let orIndex = 0;
        if (salesmanCode && salesmanName) {
            search.set(`filter[_or][${orIndex}][_and][0][salesman_code][_eq]`, salesmanCode);
            search.set(`filter[_or][${orIndex}][_and][1][salesman_name][_eq]`, salesmanName);
            orIndex += 1;
        }

        if (truckPlate) {
            search.set(`filter[_or][${orIndex}][truck_plate][_eq]`, truckPlate);
            orIndex += 1;
        }

        if (excludeId) {
            search.set("filter[id][_neq]", String(excludeId));
        }

        if (orIndex === 0) return null;

        const url = `${DIRECTUS_URL}/items/${collection}?${search.toString()}`;
        const res = await fetch(url, {
            cache: "no-store",
            headers: {
                Authorization: `Bearer ${DIRECTUS_TOKEN}`,
                "Content-Type": "application/json",
            },
        });

        if (!res.ok) {
            return null;
        }

        const json: DirectusResponse<SalesmanDraft> = await res.json();
        const data = json.data || [];
        return data.length ? data[0] : null;
    };

    const conflictSalesman = await checkCollection("salesman");
    return conflictSalesman; // Only checking active salesman table because drafts don't count if they aren't approved yet.
}

async function buildSalesmanDraftRelations() {
    try {
        const [drafts, users, divisions, branches, operations, priceTypes] = await Promise.all([
            fetchAll<SalesmanDraft>("salesman_draft").catch(() => []),
            fetchAll<User>("user").catch(() => []),
            fetchAll<Division>("division").catch(() => []),
            fetchAll<Branch>("branches").catch(() => []),
            fetchAll<Operation>("operation").catch(() => []),
            fetchAll<PriceType>("price_types").catch(() => []),
        ]);

        const regularBranches = branches.filter((b) => b.isReturn === 0 || b.isReturn === null);
        const badBranches = branches.filter((b) => b.isReturn === 1);

        const userMap = new Map(users.map(u => [u.user_id, u]));
        const divisionMap = new Map(divisions.map(d => [d.division_id, d]));
        const branchMap = new Map(regularBranches.map(b => [b.id, b]));
        const badBranchMap = new Map(badBranches.map(b => [b.id, b]));
        const operationMap = new Map(operations.map(o => [o.id, o]));
        const priceTypeMap = new Map(priceTypes.map(p => [p.price_type_id, p]));

        const enriched = drafts.map(draft => ({
            ...draft,
            employee: draft.employee_id ? userMap.get(draft.employee_id) ?? null : null,
            division: draft.division_id ? divisionMap.get(draft.division_id) ?? null : null,
            branch: draft.branch_code ? branchMap.get(draft.branch_code) ?? null : null,
            bad_branch: draft.bad_branch_code ? badBranchMap.get(draft.bad_branch_code) ?? null : null,
            operation_details: draft.operation ? operationMap.get(draft.operation) ?? null : null,
            price_type_details: draft.price_type_id ? priceTypeMap.get(draft.price_type_id) ?? null : null,
        }));

        return {
            drafts: enriched,
            users,
            divisions,
            branches: regularBranches,
            badBranches,
            operations,
            priceTypes,
        };
    } catch (error) {
        console.error("Error building salesman draft relations:", error);
        throw error;
    }
}

export async function GET() {
    try {
        const data = await buildSalesmanDraftRelations();
        return NextResponse.json(data);
    } catch (error) {
        console.error("Error fetching salesman drafts:", error);
        return NextResponse.json(
            { 
                error: "Failed to fetch salesman drafts",
                message: error instanceof Error ? error.message : "Unknown error"
            },
            { status: 500 }
        );
    }
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const draftId = Number(body.id);
        
        if (!draftId) {
            return NextResponse.json({ error: "Draft ID is required" }, { status: 400 });
        }

        // Fetch the draft
        const draftRes = await fetch(`${DIRECTUS_URL}/items/salesman_draft/${draftId}`, {
            headers: {
                "Authorization": `Bearer ${DIRECTUS_TOKEN}`,
            }
        });

        if (!draftRes.ok) {
            return NextResponse.json({ error: "Draft not found" }, { status: 404 });
        }

        const draftData = (await draftRes.json()).data;
        const editedData = { ...body };
        delete editedData.id;
        
        // Merge the edited data onto the original draft
        const mergedData = { ...draftData, ...editedData };

        // Check for conflicts
        const conflict = await findSalesmanConflict({
            employeeId: mergedData.employee_id,
            salesmanCode: mergedData.salesman_code,
            salesmanName: mergedData.salesman_name,
            truckPlate: mergedData.truck_plate
        });

        if (conflict) {
            return NextResponse.json(
                {
                    error: "Duplicate salesman",
                    message: "A salesman with this code and name combination or truck plate already exists.",
                },
                { status: 409 }
            );
        }

        const insertData = { ...mergedData };
        delete insertData.id;

        // Set the modified_date to the correct timezone
        insertData.modified_date = await getCurrentTimeInTimeZone();

        // Insert into salesman
        const insertRes = await fetch(`${DIRECTUS_URL}/items/salesman`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${DIRECTUS_TOKEN}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(insertData),
        });

        if (!insertRes.ok) {
            const errorText = await insertRes.text();
            console.error("Error inserting salesman:", errorText);
            return NextResponse.json(
                { error: "Failed to approve draft", details: errorText },
                { status: insertRes.status }
            );
        }

        // Delete the draft
        await fetch(`${DIRECTUS_URL}/items/salesman_draft/${draftId}`, {
            method: "DELETE",
            headers: {
                "Authorization": `Bearer ${DIRECTUS_TOKEN}`,
            }
        });

        return NextResponse.json({ success: true }, { status: 201 });

    } catch (error) {
        console.error("Error approving salesman draft:", error);
        return NextResponse.json(
            { error: "Failed to approve salesman draft" },
            { status: 500 }
        );
    }
}

export async function DELETE(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const id = searchParams.get("id");

        if (!id) {
            return NextResponse.json(
                { error: "Draft ID is required" },
                { status: 400 }
            );
        }

        const res = await fetch(`${DIRECTUS_URL}/items/salesman_draft/${id}`, {
            method: "DELETE",
            headers: {
                "Authorization": `Bearer ${DIRECTUS_TOKEN}`,
            },
        });

        if (!res.ok) {
            const errorText = await res.text();
            console.error("Error deleting salesman draft:", errorText);
            return NextResponse.json(
                { error: "Failed to reject salesman draft", details: errorText },
                { status: res.status }
            );
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error rejecting salesman draft:", error);
        return NextResponse.json(
            { error: "Failed to reject salesman draft" },
            { status: 500 }
        );
    }
}
