import { NextRequest, NextResponse } from "next/server";

const DIRECTUS_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
const DIRECTUS_TOKEN = process.env.DIRECTUS_STATIC_TOKEN;

if (!DIRECTUS_URL) {
    throw new Error("NEXT_PUBLIC_API_BASE_URL is not defined in environment variables");
}

export const dynamic = "force-dynamic";
export const revalidate = 0;

const LIMIT = 1000;

interface User {
    user_id: number;
    user_fname: string;
    user_lname: string;
    user_mname?: string | null;
    user_email: string;
    user_contact?: string;
    user_province?: string;
    user_city?: string;
    user_brgy?: string;
}

interface Salesman {
    id: number;
    employee_id: number;
    salesman_code: string;
    salesman_name: string;
    truck_plate?: string | null;
    division_id?: number | null;
    branch_code?: number | null;
    bad_branch_code?: number | null;
    operation?: number | null;
    company_code?: number | null;
    supplier_code?: number | null;
    price_type?: string | null;
    price_type_id?: number | null;
    isActive?: number | null;
    isInventory?: number | null;
    canCollect?: number | null;
    inventory_day?: number | null;
    modified_date?: string | null;
    encoder_id?: number | null;
}

interface Division {
    division_id: number;
    division_name: string;
}

interface Branch {
    id: number;
    branch_name: string;
    branch_code: string;
    isReturn?: number | null;
}

interface Operation {
    id: number;
    operation_name?: string | null;
}

interface PriceType {
    price_type_id: number;
    price_type_name: string;
}

interface DirectusResponse<T> {
    data: T[];
}

type EmployeePatch = {
    user_email?: string | null;
    user_contact?: string | null;
    user_province?: string | null;
    user_city?: string | null;
    user_brgy?: string | null;
};

function extractEmployeePatch(body: Record<string, unknown>): EmployeePatch {
    const patch: EmployeePatch = {};

    if ("user_email" in body) patch.user_email = (body.user_email as string) || null;
    if ("user_contact" in body) patch.user_contact = (body.user_contact as string) || null;
    if ("user_province" in body) patch.user_province = (body.user_province as string) || null;
    if ("user_city" in body) patch.user_city = (body.user_city as string) || null;
    if ("user_brgy" in body) patch.user_brgy = (body.user_brgy as string) || null;

    return patch;
}

function removeEmployeeFields(body: Record<string, unknown>) {
    const rest = { ...body };
    delete rest.user_email;
    delete rest.user_contact;
    delete rest.user_province;
    delete rest.user_city;
    delete rest.user_brgy;
    return rest;
}

async function patchEmployee(employeeId: number, patch: EmployeePatch) {
    // Avoid noisy PATCH when nothing was provided
    if (Object.keys(patch).length === 0) return;

    const res = await fetch(`${DIRECTUS_URL}/items/user/${employeeId}`, {
        method: "PATCH",
        headers: {
            "Authorization": `Bearer ${DIRECTUS_TOKEN}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify(patch),
    });

    if (!res.ok) {
        const errorText = await res.text();
        console.error("Error updating employee user:", errorText);
        throw new Error("Failed to update employee details");
    }
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

async function findSalesmanConflict(params: {
    employeeId?: number;
    salesmanCode?: string;
    salesmanName?: string;
    truckPlate?: string;
    excludeId?: number;
}): Promise<Salesman | null> {
    const { employeeId, salesmanCode, salesmanName, truckPlate, excludeId } = params;
    if (!employeeId && !salesmanCode && !salesmanName && !truckPlate) return null;

    const search = new URLSearchParams();
    search.set("limit", "1");

    let orIndex = 0;
    if (employeeId) {
        search.set(`filter[_or][${orIndex}][employee_id][_eq]`, String(employeeId));
        orIndex += 1;
    }
    if (salesmanCode) {
        search.set(`filter[_or][${orIndex}][salesman_code][_eq]`, salesmanCode);
        orIndex += 1;
    }
    if (salesmanName) {
        search.set(`filter[_or][${orIndex}][salesman_name][_eq]`, salesmanName);
        orIndex += 1;
    }

    if (truckPlate) {
        search.set(`filter[_or][${orIndex}][truck_plate][_eq]`, truckPlate);
        orIndex += 1;
    }

    if (excludeId) {
        search.set("filter[id][_neq]", String(excludeId));
    }

    const url = `${DIRECTUS_URL}/items/salesman?${search.toString()}`;
    const res = await fetch(url, {
        cache: "no-store",
        headers: {
            Authorization: `Bearer ${DIRECTUS_TOKEN}`,
            "Content-Type": "application/json",
        },
    });

    if (!res.ok) {
        const text = await res.text();
        console.error(`DIRECTUS ERROR [${url}]:`, text);
        throw new Error("Failed to check existing salesman");
    }

    const json: DirectusResponse<Salesman> = await res.json();
    const data = json.data || [];
    return data.length ? data[0] : null;
}

async function buildSalesmanRelations() {
    try {
        const [salesmenRaw, users, divisions, branches, operations, priceTypes] = await Promise.all([
            fetchAll<Salesman>("salesman").catch(() => []),
            fetchAll<User>("user").catch(() => []),
            fetchAll<Division>("division").catch(() => []),
            fetchAll<Branch>("branches").catch(() => []),
            fetchAll<Operation>("operation").catch(() => []),
            fetchAll<PriceType>("price_types").catch(() => []),
        ]);

        // Guard against duplicates in upstream data.
        // Business expectation: 1 salesman per employee_id.
        const salesmenSorted = [...salesmenRaw].sort((a, b) => {
            const aTime = a.modified_date ? Date.parse(a.modified_date) : 0;
            const bTime = b.modified_date ? Date.parse(b.modified_date) : 0;
            if (bTime !== aTime) return bTime - aTime;
            return (b.id || 0) - (a.id || 0);
        });

        const salesmen = Array.from(
            new Map(salesmenSorted.map((s) => [s.employee_id, s])).values()
        );

        const regularBranches = branches.filter((b) => b.isReturn === 0 || b.isReturn === null);
        const badBranches = branches.filter((b) => b.isReturn === 1);

        const userMap = new Map(users.map(u => [u.user_id, u]));
        const divisionMap = new Map(divisions.map(d => [d.division_id, d]));
        const branchMap = new Map(regularBranches.map(b => [b.id, b]));
        const badBranchMap = new Map(badBranches.map(b => [b.id, b]));
        const operationMap = new Map(operations.map(o => [o.id, o]));
        const priceTypeMap = new Map(priceTypes.map(p => [p.price_type_id, p]));

        const enriched = salesmen.map(salesman => ({
            ...salesman,
            employee: salesman.employee_id ? userMap.get(salesman.employee_id) ?? null : null,
            division: salesman.division_id ? divisionMap.get(salesman.division_id) ?? null : null,
            branch: salesman.branch_code ? branchMap.get(salesman.branch_code) ?? null : null,
            bad_branch: salesman.bad_branch_code ? badBranchMap.get(salesman.bad_branch_code) ?? null : null,
            operation_details: salesman.operation ? operationMap.get(salesman.operation) ?? null : null,
            price_type_details: salesman.price_type_id ? priceTypeMap.get(salesman.price_type_id) ?? null : null,
        }));

        return {
            salesmen: enriched,
            users,
            divisions,
            branches: regularBranches,
            badBranches,
            operations,
            priceTypes,
        };
    } catch (error) {
        console.error("Error building salesman relations:", error);
        throw error;
    }
}

export async function GET() {
    try {
        const data = await buildSalesmanRelations();
        return NextResponse.json(data);
    } catch (error) {
        console.error("Error fetching salesmen:", error);
        return NextResponse.json(
            { 
                error: "Failed to fetch salesmen",
                message: error instanceof Error ? error.message : "Unknown error"
            },
            { status: 500 }
        );
    }
}

export async function POST(req: NextRequest) {
    try {
        const body = (await req.json()) as Record<string, unknown>;

        const employeeId = Number(body["employee_id"]);
        if (!employeeId) {
            return NextResponse.json(
                { error: "Employee ID is required" },
                { status: 400 }
            );
        }

        const employeePatch = extractEmployeePatch(body);
        const salesmanBody = removeEmployeeFields(body);

        const salesmanCode =
            typeof salesmanBody["salesman_code"] === "string" ? (salesmanBody["salesman_code"] as string).trim() : "";

        const salesmanName =
            typeof salesmanBody["salesman_name"] === "string" ? (salesmanBody["salesman_name"] as string).trim() : "";

        const truckPlate =
            typeof salesmanBody["truck_plate"] === "string" ? (salesmanBody["truck_plate"] as string).trim() : "";

        if (salesmanName && salesmanBody["salesman_name"] !== salesmanName) {
            salesmanBody["salesman_name"] = salesmanName;
        }
        if (salesmanCode && salesmanBody["salesman_code"] !== salesmanCode) {
            salesmanBody["salesman_code"] = salesmanCode;
        }
        if (truckPlate && salesmanBody["truck_plate"] !== truckPlate) {
            salesmanBody["truck_plate"] = truckPlate;
        }

        const conflict = await findSalesmanConflict({
            employeeId,
            salesmanCode: salesmanCode || undefined,
            salesmanName: salesmanName || undefined,
            truckPlate: truckPlate || undefined,
        });
        if (conflict) {
            return NextResponse.json(
                {
                    error: "Duplicate salesman",
                    message: "A salesman with this employee, name, code, or truck plate already exists.",
                    conflictId: conflict.id,
                },
                { status: 409 }
            );
        }

        // Update linked employee info first (email/contact/address)
        await patchEmployee(employeeId, employeePatch);

        const res = await fetch(`${DIRECTUS_URL}/items/salesman`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${DIRECTUS_TOKEN}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(salesmanBody),
        });

        if (!res.ok) {
            const errorText = await res.text();
            console.error("Error creating salesman:", errorText);
            return NextResponse.json(
                { error: "Failed to create salesman", details: errorText },
                { status: res.status }
            );
        }

        const result = await res.json();
        return NextResponse.json(result.data, { status: 201 });
    } catch (error) {
        console.error("Error creating salesman:", error);
        return NextResponse.json(
            { error: "Failed to create salesman" },
            { status: 500 }
        );
    }
}

export async function PATCH(req: NextRequest) {
    try {
        const body = (await req.json()) as Record<string, unknown>;
        const { id, ...rest } = body;

        const salesmanId = Number(id);
        const employeeId = Number(rest["employee_id"]);

        if (!salesmanId) {
            return NextResponse.json(
                { error: "Salesman ID is required" },
                { status: 400 }
            );
        }

        if (!employeeId) {
            return NextResponse.json(
                { error: "Employee ID is required" },
                { status: 400 }
            );
        }

        const employeePatch = extractEmployeePatch(rest);
        const updateData = removeEmployeeFields(rest);

        const salesmanCode =
            typeof updateData["salesman_code"] === "string" ? (updateData["salesman_code"] as string).trim() : "";

        const salesmanName =
            typeof updateData["salesman_name"] === "string" ? (updateData["salesman_name"] as string).trim() : "";

        const truckPlate =
            typeof updateData["truck_plate"] === "string" ? (updateData["truck_plate"] as string).trim() : "";

        if (salesmanName && updateData["salesman_name"] !== salesmanName) {
            updateData["salesman_name"] = salesmanName;
        }
        if (salesmanCode && updateData["salesman_code"] !== salesmanCode) {
            updateData["salesman_code"] = salesmanCode;
        }
        if (truckPlate && updateData["truck_plate"] !== truckPlate) {
            updateData["truck_plate"] = truckPlate;
        }

        const conflict = await findSalesmanConflict({
            employeeId,
            salesmanCode: salesmanCode || undefined,
            salesmanName: salesmanName || undefined,
            truckPlate: truckPlate || undefined,
            excludeId: salesmanId,
        });
        if (conflict) {
            return NextResponse.json(
                {
                    error: "Duplicate salesman",
                    message: "A salesman with this employee, name, code, or truck plate already exists.",
                    conflictId: conflict.id,
                },
                { status: 409 }
            );
        }

        // Update linked employee info first (email/contact/address)
        await patchEmployee(employeeId, employeePatch);

        const res = await fetch(`${DIRECTUS_URL}/items/salesman/${salesmanId}`, {
            method: "PATCH",
            headers: {
                "Authorization": `Bearer ${DIRECTUS_TOKEN}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(updateData),
        });

        if (!res.ok) {
            const errorText = await res.text();
            console.error("Error updating salesman:", errorText);
            return NextResponse.json(
                { error: "Failed to update salesman", details: errorText },
                { status: res.status }
            );
        }

        const result = await res.json();
        return NextResponse.json(result.data);
    } catch (error) {
        console.error("Error updating salesman:", error);
        return NextResponse.json(
            { error: "Failed to update salesman" },
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
                { error: "Salesman ID is required" },
                { status: 400 }
            );
        }

        const res = await fetch(`${DIRECTUS_URL}/items/salesman/${id}`, {
            method: "DELETE",
            headers: {
                "Authorization": `Bearer ${DIRECTUS_TOKEN}`,
            },
        });

        if (!res.ok) {
            const errorText = await res.text();
            console.error("Error deleting salesman:", errorText);
            return NextResponse.json(
                { error: "Failed to delete salesman", details: errorText },
                { status: res.status }
            );
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error deleting salesman:", error);
        return NextResponse.json(
            { error: "Failed to delete salesman" },
            { status: 500 }
        );
    }
}
