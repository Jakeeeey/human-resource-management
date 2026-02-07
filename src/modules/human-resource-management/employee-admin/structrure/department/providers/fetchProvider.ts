import type {
    Department,
    Division,
    User,
    DepartmentWithRelations,
    DirectusResponse,
} from "../types";

const DIRECTUS_URL = "http://100.110.197.61:8056";
const LIMIT_PER_REQUEST = 1000;

const COLLECTIONS = {
    DEPARTMENT: "department",
    DIVISION: "division",
    USERS: "user",
} as const;

// ============================================================================
// GENERIC FETCH
// ============================================================================

async function fetchAll<T>(
    collection: string,
    offset = 0,
    accumulated: T[] = []
): Promise<T[]> {
    const url = `${DIRECTUS_URL}/items/${collection}?limit=${LIMIT_PER_REQUEST}&offset=${offset}`;

    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`Fetch failed ${collection}`);

    const json: DirectusResponse<T> = await res.json();
    const items = json.data ?? [];
    const all = [...accumulated, ...items];

    if (items.length === LIMIT_PER_REQUEST) {
        return fetchAll(collection, offset + LIMIT_PER_REQUEST, all);
    }

    return all;
}

// ============================================================================
// FETCHERS
// ============================================================================

export const fetchAllDepartments = () =>
    fetchAll<Department>(COLLECTIONS.DEPARTMENT);

export const fetchAllDivisions = () =>
    fetchAll<Division>(COLLECTIONS.DIVISION);

export async function fetchAllUsers(): Promise<User[]> {
    const res = await fetch(
        `${DIRECTUS_URL}/items/${COLLECTIONS.USERS}?fields=user_id,user_fname,user_lname,user_email`,
        { cache: "no-store" }
    );

    if (!res.ok) throw new Error("Users fetch failed");

    const json: DirectusResponse<User> = await res.json();
    return json.data ?? [];
}

// ============================================================================
// JOIN LOGIC (FIXED)
// ============================================================================

export async function fetchDepartmentsWithRelations() {
    const [departments, divisions, users] = await Promise.all([
        fetchAllDepartments(),
        fetchAllDivisions(),
        fetchAllUsers(),
    ]);

    const divisionMap = new Map(
        divisions.map(d => [Number(d.division_id), d])
    );

    const userMapById = new Map(
        users.map(u => [u.user_id, u])
    );

    const userMapByName = new Map(
        users.map(u => [
            `${u.user_fname} ${u.user_lname}`.trim().toLowerCase(),
            u
        ])
    );

    const departmentsWithRelations: DepartmentWithRelations[] =
        departments.map(dept => {
            let headId: number | null = null;
            let headUser: User | null = null;

            const raw = dept.department_head;

            // number FK
            if (typeof raw === "number") {
                headId = raw;
                headUser = userMapById.get(raw) ?? null;
            }

            // numeric string FK
            else if (typeof raw === "string" && /^\d+$/.test(raw)) {
                headId = Number(raw);
                headUser = userMapById.get(headId) ?? null;
            }

            // full name string
            else if (typeof raw === "string") {
                const u = userMapByName.get(raw.trim().toLowerCase());
                if (u) {
                    headUser = u;
                    headId = u.user_id;
                }
            }

            // object relation
            else if (typeof raw === "object" && raw !== null) {
                const id = (raw as any).user_id;
                if (typeof id === "number") {
                    headId = id;
                    headUser = userMapById.get(id) ?? null;
                }
            }

            return {
                ...dept,
                division: divisionMap.get(Number(dept.parent_division)) ?? null,
                department_head_id: headId,
                department_head_user: headUser,
            };
        });

    return { departments: departmentsWithRelations, divisions, users };
}




// ============================================================================
// CRUD
// ============================================================================

export async function createDepartment(data: {
    department_name: string;
    parent_division: number;
    department_description: string;
    department_head: number | null;
}) {
    const res = await fetch(`${DIRECTUS_URL}/items/department`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
    });

    return (await res.json()).data[0];
}

export async function updateDepartment(
    id: number,
    data: Partial<{
        department_name: string;
        parent_division: number;
        department_description: string;
        department_head: number | null;
    }>
) {
    const res = await fetch(`${DIRECTUS_URL}/items/department/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
    });

    return (await res.json()).data[0];
}

export async function deleteDepartment(id: number) {
    await fetch(`${DIRECTUS_URL}/items/department/${id}`, {
        method: "DELETE",
    });
}
