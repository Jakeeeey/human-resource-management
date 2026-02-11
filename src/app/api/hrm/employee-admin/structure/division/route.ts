import { NextRequest, NextResponse } from "next/server";

// ============================================================================
// CONFIG
// ============================================================================

const DIRECTUS_URL = "http://100.110.197.61:8056";
const LIMIT = 1000;

const COLLECTIONS = {
    DIVISION: "division",
    DEPARTMENT: "department",
    USER: "user",
    DEPT_PER_DIV: "department_per_division",
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

// ============================================================================
// TYPES
// ============================================================================

interface User {
    user_id: number;
    user_fname: string;
    user_lname: string;
    user_mname?: string | null;
}

interface Division {
    division_id: number;
    division_name: string;
    division_description: string | null;
    division_code: string | null;
    date_added: string;
    division_head_id: number | null;
}

interface Department {
    department_id: number;
    department_name: string;
}

interface DepartmentPerDivision {
    id: number;
    division_id: number;
    department_id: number;
    bank_id: number | null;
}

interface DirectusResponse<T> {
    data: T[];
}

// ============================================================================
// HELPERS
// ============================================================================

async function fetchAll<T>(collection: string, offset = 0, acc: T[] = []): Promise<T[]> {
    const url = `${DIRECTUS_URL}/items/${collection}?limit=${LIMIT}&offset=${offset}`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`Directus error ${collection}`);

    const json: DirectusResponse<T> = await res.json();
    const items = json.data || [];
    const all = [...acc, ...items];

    if (items.length === LIMIT) {
        return fetchAll(collection, offset + LIMIT, all);
    }

    return all;
}

async function fetchUsers(): Promise<User[]> {
    const url = `${DIRECTUS_URL}/items/${COLLECTIONS.USER}?limit=${LIMIT}&fields=user_id,user_fname,user_lname,user_mname`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return [];

    const json: DirectusResponse<User> = await res.json();
    return json.data || [];
}

// ============================================================================
// JOIN BUILDER
// ============================================================================

async function buildDivisionRelations() {
    const [divisions, users, departments, deptPerDiv] = await Promise.all([
        fetchAll<Division>(COLLECTIONS.DIVISION),
        fetchUsers(),
        fetchAll<Department>(COLLECTIONS.DEPARTMENT),
        fetchAll<DepartmentPerDivision>(COLLECTIONS.DEPT_PER_DIV),
    ]);

    const userMap = new Map(users.map(u => [u.user_id, u]));
    const deptMap = new Map(departments.map(d => [d.department_id, d]));

    // Group departments by division
    const divisionDepartmentsMap = new Map<number, Department[]>();
    deptPerDiv.forEach(dpd => {
        if (!divisionDepartmentsMap.has(dpd.division_id)) {
            divisionDepartmentsMap.set(dpd.division_id, []);
        }
        const dept = deptMap.get(dpd.department_id);
        if (dept) {
            divisionDepartmentsMap.get(dpd.division_id)!.push(dept);
        }
    });

    const enriched = divisions.map(div => ({
        ...div,
        division_head_user: div.division_head_id ? userMap.get(div.division_head_id) : undefined,
        departments: divisionDepartmentsMap.get(div.division_id) || [],
        department_count: (divisionDepartmentsMap.get(div.division_id) || []).length,
    }));

    return { enriched, users, departments };
}

// ============================================================================
// GET - List All Divisions
// ============================================================================

export async function GET(req: NextRequest) {
    try {
        const { enriched, users, departments } = await buildDivisionRelations();

        return NextResponse.json({
            divisions: enriched,
            users,
            departments,
            metadata: {
                total: enriched.length,
                lastUpdated: new Date().toISOString(),
            },
        });
    } catch (e) {
        console.error("Division API GET error:", e);
        return NextResponse.json(
            { error: "Failed to fetch divisions" },
            { status: 500 }
        );
    }
}

// ============================================================================
// POST - Create Division
// ============================================================================

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { department_ids, ...divisionData } = body;

        // 1️⃣ Create division
        const divRes = await fetch(
            `${DIRECTUS_URL}/items/${COLLECTIONS.DIVISION}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    division_name: divisionData.division_name,
                    division_code: divisionData.division_code,
                    division_head_id: divisionData.division_head_id,
                    division_description: divisionData.division_description,
                    date_added: new Date().toISOString().split("T")[0],
                }),
            }
        );

        if (!divRes.ok) {
            const errorText = await divRes.text();
            console.error("POST division error:", errorText);
            throw new Error("Directus division create failed");
        }

        // ✅ Directus returns single object — not array
        const divJson = await divRes.json();
        const newDivision: Division = divJson.data;

        if (!newDivision || !newDivision.division_id) {
            throw new Error("Directus did not return created division");
        }

        // 2️⃣ Create department_per_division links
        if (Array.isArray(department_ids) && department_ids.length > 0) {
            for (const dept_id of department_ids) {
                await fetch(
                    `${DIRECTUS_URL}/items/${COLLECTIONS.DEPT_PER_DIV}`,
                    {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            division_id: newDivision.division_id,
                            department_id: dept_id,
                            bank_id: null,
                        }),
                    }
                );
            }
        }

        return NextResponse.json({ division: newDivision });

    } catch (e) {
        console.error("Division API POST error:", e);
        return NextResponse.json(
            {
                error: "Failed to create division",
                message: e instanceof Error ? e.message : "Unknown error",
            },
            { status: 500 }
        );
    }
}


// ============================================================================
// PATCH - Update Division
// ============================================================================

export async function PATCH(req: NextRequest) {
    try {
        const body = await req.json();
        const { division_id, department_ids, ...updateData } = body;

        if (!division_id) {
            return NextResponse.json(
                { error: "division_id is required" },
                { status: 400 }
            );
        }

        // 1. Update division
        const divRes = await fetch(
            `${DIRECTUS_URL}/items/${COLLECTIONS.DIVISION}/${division_id}`,
            {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(updateData),
            }
        );

        if (!divRes.ok) {
            throw new Error(`Failed to update division: ${divRes.statusText}`);
        }

        // 2. Update department assignments
        if (department_ids !== undefined) {
            // Delete existing assignments
            const existing = await fetchAll<DepartmentPerDivision>(COLLECTIONS.DEPT_PER_DIV);
            const toDelete = existing.filter(dpd => dpd.division_id === division_id);

            for (const dpd of toDelete) {
                await fetch(`${DIRECTUS_URL}/items/${COLLECTIONS.DEPT_PER_DIV}/${dpd.id}`, {
                    method: "DELETE",
                });
            }

            // Create new assignments
            if (department_ids.length > 0) {
                const dpdRecords = department_ids.map((dept_id: number) => ({
                    division_id,
                    department_id: dept_id,
                    bank_id: null,
                }));

                for (const record of dpdRecords) {
                    await fetch(`${DIRECTUS_URL}/items/${COLLECTIONS.DEPT_PER_DIV}`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(record),
                    });
                }
            }
        }

        const divJson = await divRes.json();
        return NextResponse.json(divJson);
    } catch (e) {
        console.error("Division API PATCH error:", e);
        return NextResponse.json(
            { error: "Failed to update division", message: e instanceof Error ? e.message : "Unknown error" },
            { status: 500 }
        );
    }
}

// ============================================================================
// DELETE - Delete Division
// ============================================================================

export async function DELETE(req: NextRequest) {
    try {
        const id = req.nextUrl.searchParams.get("id");

        if (!id) {
            return NextResponse.json(
                { error: "Division ID is required" },
                { status: 400 }
            );
        }

        // Delete department_per_division records first
        const existing = await fetchAll<DepartmentPerDivision>(COLLECTIONS.DEPT_PER_DIV);
        const toDelete = existing.filter(dpd => dpd.division_id === parseInt(id));

        for (const dpd of toDelete) {
            await fetch(`${DIRECTUS_URL}/items/${COLLECTIONS.DEPT_PER_DIV}/${dpd.id}`, {
                method: "DELETE",
            });
        }

        // Delete division
        const res = await fetch(
            `${DIRECTUS_URL}/items/${COLLECTIONS.DIVISION}/${id}`,
            { method: "DELETE" }
        );

        if (!res.ok) {
            throw new Error(`Failed to delete division: ${res.statusText}`);
        }

        return NextResponse.json({ success: true });
    } catch (e) {
        console.error("Division API DELETE error:", e);
        return NextResponse.json(
            { error: "Failed to delete division", message: e instanceof Error ? e.message : "Unknown error" },
            { status: 500 }
        );
    }
}