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
    DEPT_PER_DIV: "department_per_division",
    CHART_OF_ACCOUNTS: "chart_of_accounts",
    DEPT_DIV_COA: "department_division_coa",
    ACCOUNT_TYPES: "account_types",
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

// ============================================================================
// TYPES
// ============================================================================

interface Division {
    division_id: number;
    division_name: string;
    division_code: string | null;
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

interface ChartOfAccount {
    coa_id: number;
    gl_code: string | null;
    account_title: string | null;
    bsis_code: number | null;
    account_type: number | null;
    balance_type: number | null;
    description: string | null;
    memo_type: number | null;
    date_added: string | null;
    added_by: number | null;
    isPayment: boolean;
    is_payment: boolean | null;
}

interface AccountType {
    id: number;
    account_name: string;
    description: string | null;
}

interface DepartmentDivisionCOA {
    id: number;
    dept_div_id: number;
    coa_id: number;
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

// ============================================================================
// GET - Fetch All Data for Department Accounts
// ============================================================================

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = req.nextUrl;
        const deptDivId = searchParams.get("dept_div_id");

        // If dept_div_id is provided, return assigned accounts for that department
        if (deptDivId) {
            // Probing for assignments collection
            let assignments: DepartmentDivisionCOA[] = [];
            const possibleAssignCollections = ["department_division_coa", "dept_div_coa", "assigned_accounts"];

            const [allAccounts, accountTypes] = await Promise.all([
                fetchAll<ChartOfAccount>(COLLECTIONS.CHART_OF_ACCOUNTS),
                fetchAll<AccountType>(COLLECTIONS.ACCOUNT_TYPES),
            ]);

            for (const coll of possibleAssignCollections) {
                try {
                    assignments = await fetchAll<DepartmentDivisionCOA>(coll);
                    console.log(`Successfully fetched from assignment collection: ${coll}`);
                    break;
                } catch {
                    console.warn(`Failed to fetch from assignment collection: ${coll}, trying next...`);
                }
            }

            const accountTypeMap = new Map(accountTypes.map(at => [at.id, at]));

            // Filter assignments for this dept_div_id
            const assignedCoaIds = new Set(
                assignments
                    .filter(a => a.dept_div_id === parseInt(deptDivId))
                    .map(a => a.coa_id)
            );

            // Enrich accounts with account type info
            const enrichedAccounts = allAccounts.map(acc => ({
                ...acc,
                account_type_info: acc.account_type ? accountTypeMap.get(acc.account_type) : null,
            }));

            const assignedAccounts = enrichedAccounts.filter(acc => assignedCoaIds.has(acc.coa_id));
            const availableAccounts = enrichedAccounts.filter(acc => !assignedCoaIds.has(acc.coa_id));

            return NextResponse.json({
                assigned: assignedAccounts,
                available: availableAccounts,
            });
        }

        // Otherwise, return all master data
        // Probing for link collection
        let deptPerDiv: DepartmentPerDivision[] = [];
        const possibleLinkCollections = ["department_per_division", "division_departments", "dept_div"];

        const [divisions, departments, accounts, accountTypes] = await Promise.all([
            fetchAll<Division>(COLLECTIONS.DIVISION),
            fetchAll<Department>(COLLECTIONS.DEPARTMENT),
            fetchAll<ChartOfAccount>(COLLECTIONS.CHART_OF_ACCOUNTS),
            fetchAll<AccountType>(COLLECTIONS.ACCOUNT_TYPES),
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

        // Build division -> departments mapping
        const divisionDepartmentsMap = new Map<number, DepartmentPerDivision[]>();
        deptPerDiv.forEach(dpd => {
            if (!divisionDepartmentsMap.has(dpd.division_id)) {
                divisionDepartmentsMap.set(dpd.division_id, []);
            }
            divisionDepartmentsMap.get(dpd.division_id)!.push(dpd);
        });

        const deptMap = new Map(departments.map(d => [d.department_id, d]));
        const accountTypeMap = new Map(accountTypes.map(at => [at.id, at]));

        // Enrich divisions with their departments
        const enrichedDivisions = divisions.map(div => ({
            ...div,
            department_per_divisions: (divisionDepartmentsMap.get(div.division_id) || []).map(dpd => ({
                ...dpd,
                department: deptMap.get(dpd.department_id),
            })),
        }));

        // Enrich accounts with account type
        const enrichedAccounts = accounts.map(acc => ({
            ...acc,
            account_type_info: acc.account_type ? accountTypeMap.get(acc.account_type) : null,
        }));

        return NextResponse.json({
            divisions: enrichedDivisions,
            departments,
            department_per_divisions: deptPerDiv,
            accounts: enrichedAccounts,
            account_types: accountTypes,
            metadata: {
                total_divisions: divisions.length,
                total_departments: departments.length,
                total_accounts: accounts.length,
                lastUpdated: new Date().toISOString(),
            },
        });
    } catch (e) {
        console.error("Department Accounts API GET error:", e);
        return NextResponse.json(
            { error: "Failed to fetch department accounts data" },
            { status: 500 }
        );
    }
}

// ============================================================================
// POST - Assign Accounts to Department
// ============================================================================

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { dept_div_id, coa_ids } = body;

        if (!dept_div_id || !Array.isArray(coa_ids) || coa_ids.length === 0) {
            return NextResponse.json(
                { error: "dept_div_id and coa_ids array are required" },
                { status: 400 }
            );
        }

        // Create assignments
        const createdAssignments = [];
        for (const coa_id of coa_ids) {
            const res = await fetch(
                `${DIRECTUS_URL}/items/${COLLECTIONS.DEPT_DIV_COA}`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        dept_div_id,
                        coa_id,
                    }),
                }
            );

            if (!res.ok) {
                const errorText = await res.text();
                console.error("POST assignment error:", errorText);
                // Continue with other assignments even if one fails
                continue;
            }

            const json = await res.json();
            createdAssignments.push(json.data);
        }

        return NextResponse.json({
            success: true,
            created: createdAssignments.length,
            assignments: createdAssignments,
        });
    } catch (e) {
        console.error("Department Accounts API POST error:", e);
        return NextResponse.json(
            {
                error: "Failed to assign accounts",
                message: e instanceof Error ? e.message : "Unknown error",
            },
            { status: 500 }
        );
    }
}

// ============================================================================
// DELETE - Unassign Account from Department
// ============================================================================

export async function DELETE(req: NextRequest) {
    try {
        const { searchParams } = req.nextUrl;
        const id = searchParams.get("id");
        const deptDivId = searchParams.get("dept_div_id");
        const coaId = searchParams.get("coa_id");

        // Option 1: Delete by assignment ID
        if (id) {
            const res = await fetch(
                `${DIRECTUS_URL}/items/${COLLECTIONS.DEPT_DIV_COA}/${id}`,
                { method: "DELETE" }
            );

            if (!res.ok) {
                throw new Error(`Failed to delete assignment: ${res.statusText}`);
            }

            return NextResponse.json({ success: true });
        }

        // Option 2: Delete by dept_div_id + coa_id combination
        if (deptDivId && coaId) {
            const allAssignments = await fetchAll<DepartmentDivisionCOA>(COLLECTIONS.DEPT_DIV_COA);
            const targetAssignment = allAssignments.find(
                a => a.dept_div_id === parseInt(deptDivId) && a.coa_id === parseInt(coaId)
            );

            if (!targetAssignment) {
                return NextResponse.json(
                    { error: "Assignment not found" },
                    { status: 404 }
                );
            }

            const res = await fetch(
                `${DIRECTUS_URL}/items/${COLLECTIONS.DEPT_DIV_COA}/${targetAssignment.id}`,
                { method: "DELETE" }
            );

            if (!res.ok) {
                throw new Error(`Failed to delete assignment: ${res.statusText}`);
            }

            return NextResponse.json({ success: true });
        }

        return NextResponse.json(
            { error: "Either 'id' or both 'dept_div_id' and 'coa_id' are required" },
            { status: 400 }
        );
    } catch (e) {
        console.error("Department Accounts API DELETE error:", e);
        return NextResponse.json(
            {
                error: "Failed to unassign account",
                message: e instanceof Error ? e.message : "Unknown error",
            },
            { status: 500 }
        );
    }
}
