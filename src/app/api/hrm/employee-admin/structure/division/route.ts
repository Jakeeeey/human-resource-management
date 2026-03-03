import { NextRequest, NextResponse } from "next/server";

// ============================================================================
// CONFIG
// ============================================================================

const DIRECTUS_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
if (!DIRECTUS_URL) {
    throw new Error("NEXT_PUBLIC_API_BASE_URL is not defined in environment variables");
}
const LIMIT = 1000;

const COLLECTIONS = {
    DIVISION: "division",
    DEPARTMENT: "department",
    USER: "user",
    DEPT_PER_DIV: "department_per_division",
    BANK_ACCOUNTS: "bank_accounts",
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

interface BankAccount {
    bank_id: number;
    bank_name: string;
    account_number: string;
    bank_description: string;
    branch: string;
    is_active: boolean;
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
    const res = await fetch(url, {
        cache: "no-store",
        headers: {
            "Authorization": `Bearer ${process.env.DIRECTUS_STATIC_TOKEN}`
        }
    });
    if (!res.ok) {
        const text = await res.text();
        console.error(`DIRECTUS ERROR [${url}]:`, text);
        throw new Error(`Directus error ${collection}: ${text}`);
    }

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
    const res = await fetch(url, {
        cache: "no-store",
        headers: {
            "Authorization": `Bearer ${process.env.DIRECTUS_STATIC_TOKEN}`
        }
    });
    if (!res.ok) return [];

    const json: DirectusResponse<User> = await res.json();
    return json.data || [];
}

// ============================================================================
// JOIN BUILDER
// ============================================================================

async function buildDivisionRelations() {
    // Try multiple possible collection names for dept_per_div
    let deptPerDiv: DepartmentPerDivision[] = [];
    const possibleLinkCollections = ["department_per_division", "division_departments", "dept_div"];

    // Fetch static data first
    const [divisions, users, departments, bankAccounts] = await Promise.all([
        fetchAll<Division>(COLLECTIONS.DIVISION),
        fetchUsers(),
        fetchAll<Department>(COLLECTIONS.DEPARTMENT),
        fetchAll<BankAccount>(COLLECTIONS.BANK_ACCOUNTS),
    ]);

    for (const coll of possibleLinkCollections) {
        try {
            deptPerDiv = await fetchAll<DepartmentPerDivision>(coll);
            console.log(`Successfully fetched from link collection: ${coll}`);
            break;
        } catch {
            console.warn(`Failed to fetch from link collection: ${coll}, trying next...`);
        }
    }

    const userMap = new Map(users.map(u => [u.user_id, u]));
    const deptMap = new Map(departments.map(d => [d.department_id, d]));

    // Group departments by division
    const divisionDepartmentsMap = new Map<number, (Department & { bank_id: number | null })[]>();
    deptPerDiv.forEach(dpd => {
        if (!divisionDepartmentsMap.has(dpd.division_id)) {
            divisionDepartmentsMap.set(dpd.division_id, []);
        }
        const dept = deptMap.get(dpd.department_id);
        if (dept) {
            divisionDepartmentsMap.get(dpd.division_id)!.push({
                ...dept,
                bank_id: dpd.bank_id
            });
        }
    });

    const enriched = divisions.map(div => ({
        ...div,
        division_head_user: div.division_head_id ? userMap.get(div.division_head_id) : undefined,
        departments: divisionDepartmentsMap.get(div.division_id) || [],
        department_count: (divisionDepartmentsMap.get(div.division_id) || []).length,
    }));

    return { enriched, users, departments, bankAccounts };
}

// ============================================================================
// GET - List All Divisions
// ============================================================================

export async function GET() {
    try {
        const { enriched, users, departments, bankAccounts } = await buildDivisionRelations();

        return NextResponse.json({
            divisions: enriched,
            users,
            departments,
            bank_accounts: bankAccounts,
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
    if (!process.env.DIRECTUS_STATIC_TOKEN) {
        return NextResponse.json({ error: "Server Error: DIRECTUS_STATIC_TOKEN is missing" }, { status: 500 });
    }

    try {
        const body = await req.json();
        const { division_name, division_code, division_description, division_head_id, date_added, department_ids } = body;

        // 1ï¸âƒ£ Create division
        const newDivisionData: Record<string, string | number | null> = {
            division_name,
            division_code,
            division_description,
            division_head_id,
            date_added: date_added || new Date().toISOString().split("T")[0],
        };

        // Sanitization
        if (newDivisionData.division_head_id === "" || newDivisionData.division_head_id === "0") {
            newDivisionData.division_head_id = null;
        } else if (newDivisionData.division_head_id) {
            newDivisionData.division_head_id = Number(newDivisionData.division_head_id);
        }

        if (typeof newDivisionData.date_added === 'string' && newDivisionData.date_added.includes("T")) {
            newDivisionData.date_added = newDivisionData.date_added.split("T")[0];
        }

        const divRes = await fetch(
            `${DIRECTUS_URL}/items/${COLLECTIONS.DIVISION}`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${process.env.DIRECTUS_STATIC_TOKEN}`
                },
                body: JSON.stringify(newDivisionData),
            }
        );

        if (!divRes.ok) {
            const errorText = await divRes.text();
            console.error("POST division error:", {
                status: divRes.status,
                statusText: divRes.statusText,
                body: errorText,
                payload: newDivisionData
            });
            throw new Error(`Directus division create failed: ${divRes.statusText} - ${errorText}`);
        }

        // âœ… Directus returns single object â€” not array
        const divJson = await divRes.json();
        const newDivision: Division = divJson.data;

        if (!newDivision || !newDivision.division_id) {
            throw new Error("Directus did not return created division");
        }

        // 2ï¸âƒ£ Create department_per_division links
        // Handle simplified array request (old) or assignment objects (new)
        let assignments: { department_id: number; bank_id: number | null }[] = [];

        if (Array.isArray(department_ids) && department_ids.length > 0) {
            console.warn("Using deprecated department_ids array in POST");
            assignments = department_ids.map((id: number) => ({ department_id: id, bank_id: null }));
        } else if (Array.isArray(body.department_assignments)) {
            assignments = body.department_assignments;
        }

        if (assignments.length > 0) {
            for (const assignment of assignments) {
                await fetch(
                    `${DIRECTUS_URL}/items/${COLLECTIONS.DEPT_PER_DIV}`,
                    {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            "Authorization": `Bearer ${process.env.DIRECTUS_STATIC_TOKEN}`
                        },
                        body: JSON.stringify({
                            division_id: newDivision.division_id,
                            department_id: assignment.department_id,
                            bank_id: assignment.bank_id || null,
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
    if (!process.env.DIRECTUS_STATIC_TOKEN) {
        return NextResponse.json({ error: "Server Error: DIRECTUS_STATIC_TOKEN is missing" }, { status: 500 });
    }
    try {
        const body = await req.json();
        // Crucial fix: Extract department_assignments so it doesn't get sent to Directus division update
        const { division_id, department_ids, department_assignments, ...updateData } = body;

        if (!division_id) {
            return NextResponse.json(
                { error: "division_id is required" },
                { status: 400 }
            );
        }

        // 1. Update division
        // Sanitization
        if (updateData.division_head_id === "" || updateData.division_head_id === "0") {
            updateData.division_head_id = null;
        } else if (updateData.division_head_id) {
            updateData.division_head_id = Number(updateData.division_head_id);
        }

        if (updateData.date_added && typeof updateData.date_added === 'string') {
            // Ensure it's YYYY-MM-DD if it's a full ISO string
            updateData.date_added = updateData.date_added.split("T")[0];
        }

        // Filter out undefined values to avoid sending bad data
        const cleanUpdateData = Object.fromEntries(
            Object.entries(updateData).filter(([, v]) => v !== undefined)
        );

        const divRes = await fetch(
            `${DIRECTUS_URL}/items/${COLLECTIONS.DIVISION}/${division_id}`,
            {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${process.env.DIRECTUS_STATIC_TOKEN}` // Ensure token is passed
                },
                body: JSON.stringify(cleanUpdateData),
            }
        );

        if (!divRes.ok) {
            console.error("Division update failed", {
                status: divRes.status,
                statusText: divRes.statusText,
                url: divRes.url,
                payload: cleanUpdateData
            });
            const text = await divRes.text();
            console.error("Error body:", text);
            throw new Error(`Failed to update division: ${divRes.statusText}`);
        }

        // 2. Update department assignments
        if (department_ids !== undefined || department_assignments !== undefined) {
            // Delete existing assignments
            const existing = await fetchAll<DepartmentPerDivision>(COLLECTIONS.DEPT_PER_DIV);
            // Filter by division_id to only delete relevant assignments
            const toDelete = existing.filter(dpd => dpd.division_id === Number(division_id));

            for (const dpd of toDelete) {
                await fetch(`${DIRECTUS_URL}/items/${COLLECTIONS.DEPT_PER_DIV}/${dpd.id}`, {
                    method: "DELETE",
                    headers: {
                        "Authorization": `Bearer ${process.env.DIRECTUS_STATIC_TOKEN}`
                    }
                });
            }

            // Create new assignments
            let assignments: { department_id: number; bank_id: number | null }[] = [];

            if (Array.isArray(department_assignments)) {
                assignments = department_assignments;
            } else if (Array.isArray(department_ids)) {
                assignments = department_ids.map((id: number) => ({ department_id: id, bank_id: null }));
            }

            if (assignments.length > 0) {
                for (const assignment of assignments) {
                    await fetch(`${DIRECTUS_URL}/items/${COLLECTIONS.DEPT_PER_DIV}`, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            "Authorization": `Bearer ${process.env.DIRECTUS_STATIC_TOKEN}`
                        },
                        body: JSON.stringify({
                            division_id,
                            department_id: assignment.department_id,
                            bank_id: assignment.bank_id || null,
                        }),
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
    if (!process.env.DIRECTUS_STATIC_TOKEN) {
        return NextResponse.json({ error: "Server Error: DIRECTUS_STATIC_TOKEN is missing" }, { status: 500 });
    }
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
                headers: {
                    "Authorization": `Bearer ${process.env.DIRECTUS_STATIC_TOKEN}`
                }
            });
        }

        // Delete division
        const res = await fetch(
            `${DIRECTUS_URL}/items/${COLLECTIONS.DIVISION}/${id}`,
            {
                method: "DELETE",
                headers: {
                    "Authorization": `Bearer ${process.env.DIRECTUS_STATIC_TOKEN}`
                }
            }
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