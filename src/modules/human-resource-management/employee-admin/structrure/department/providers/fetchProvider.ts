import type {
    Department,
    Division,
    User,
    DepartmentWithRelations,
    DirectusResponse,
    DepartmentPosition,
} from "../types";
const DIRECTUS_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

const COLLECTIONS = {
    DEPARTMENT: "department",
    DIVISION: "division",
    USERS: "user",
    DEPARTMENT_POSITIONS: "department_positions",
} as const;

// ============================================================================
// GENERIC FETCH
// ============================================================================

async function fetchAll<T>(collection: string): Promise<T[]> {
    const url = `${DIRECTUS_URL}/items/${collection}?limit=-1`;

    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`Fetch failed ${collection}`);

    const json: DirectusResponse<T> = await res.json();
    return json.data ?? [];
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
        `${DIRECTUS_URL}/items/${COLLECTIONS.USERS}?fields=user_id,user_fname,user_lname,user_email,user_department&limit=-1`,
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
    const [departments, divisions, users, positions] = await Promise.all([
        fetchAllDepartments(),
        fetchAllDivisions(),
        fetchAllUsers(),
        fetchAll<DepartmentPosition>(COLLECTIONS.DEPARTMENT_POSITIONS),
    ]);

    const divisionMap = new Map(
        divisions.map(d => [Number(d.division_id), d])
    );

    const userMapById = new Map(
        users.map(u => [u.user_id, u])
    );

    // ✅ group positions by department
    const positionMap = new Map<number, DepartmentPosition[]>();

    for (const p of positions) {
        if (!positionMap.has(p.department_id)) {
            positionMap.set(p.department_id, []);
        }
        positionMap.get(p.department_id)!.push(p);
    }

    const departmentsWithRelations: DepartmentWithRelations[] =
        departments.map(dept => {

            const headId = dept.department_head_id;

            return {
                ...dept,
                division: divisionMap.get(Number(dept.parent_division)) ?? null,
                department_head_id: headId,
                department_head_user: headId
                    ? userMapById.get(headId) ?? null
                    : null,

                positions: positionMap.get(dept.department_id) ?? [],
            };
        });

    return { departments: departmentsWithRelations, divisions, users };
}






