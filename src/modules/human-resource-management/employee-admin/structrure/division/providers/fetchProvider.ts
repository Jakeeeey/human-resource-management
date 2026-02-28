import type {
    Division,
    Department,
    User,
    DepartmentPerDivision,
    DepartmentWithBank,
    DivisionWithRelations,
    DirectusListResponse,
    DirectusSingleResponse,
} from "../types";

const DIRECTUS_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
const LIMIT = 1000;

// =====================================================
// generic paginated fetch
// =====================================================

async function fetchAll<T>(collection: string, offset = 0, acc: T[] = []): Promise<T[]> {
    const res = await fetch(
        `${DIRECTUS_URL}/items/${collection}?limit=${LIMIT}&offset=${offset}`,
        { cache: "no-store" }
    );

    if (!res.ok) throw new Error(`Fetch failed: ${collection}`);

    const json: DirectusListResponse<T> = await res.json();
    const items = json.data ?? [];
    const merged = [...acc, ...items];

    if (items.length === LIMIT) {
        return fetchAll(collection, offset + LIMIT, merged);
    }

    return merged;
}

// =====================================================
// base fetchers
// =====================================================

export const fetchDivisions = () => fetchAll<Division>("division");
export const fetchDepartments = () => fetchAll<Department>("department");
export const fetchDivisionDepartments = () =>
    fetchAll<DepartmentPerDivision>("department_per_division");

export async function fetchUsers(): Promise<User[]> {
    const res = await fetch(
        `${DIRECTUS_URL}/items/user?fields=user_id,user_fname,user_lname,user_email`,
        { cache: "no-store" }
    );
    if (!res.ok) throw new Error("Users fetch failed");
    const json: DirectusListResponse<User> = await res.json();
    return json.data ?? [];
}

// =====================================================
// JOIN builder
// =====================================================

export async function fetchDivisionsWithRelations(): Promise<DivisionWithRelations[]> {
    const [divisions, departments, links, users] = await Promise.all([
        fetchDivisions(),
        fetchDepartments(),
        fetchDivisionDepartments(),
        fetchUsers(),
    ]);

    const userMap = new Map(users.map(u => [u.user_id, u]));
    const deptMap = new Map(departments.map(d => [d.department_id, d]));

    return divisions.map(div => {
        const relLinks = links.filter(
            l => Number(l.division_id) === Number(div.division_id)
        );

        const relDepartments = relLinks
            .map(l => {
                const dept = deptMap.get(l.department_id);
                if (!dept) return null;
                return {
                    ...dept,
                    bank_id: l.bank_id
                };
            })
            .filter(Boolean) as DepartmentWithBank[];

        return {
            ...div,
            division_head_user: div.division_head_id
                ? userMap.get(div.division_head_id) ?? null
                : null,
            departments: relDepartments,
            department_count: relDepartments.length,
        };
    });
}

// =====================================================
// CRUD
// =====================================================

export async function createDivision(data: Partial<Division>): Promise<Division> {
    const res = await fetch(`${DIRECTUS_URL}/items/division`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
    });

    if (!res.ok) throw new Error("Create division failed");

    const json: DirectusSingleResponse<Division> = await res.json();
    return json.data;
}

export async function updateDivision(
    id: number,
    data: Partial<Division>
): Promise<Division> {
    const res = await fetch(`${DIRECTUS_URL}/items/division/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
    });

    if (!res.ok) throw new Error("Update division failed");

    const json: DirectusSingleResponse<Division> = await res.json();
    return json.data;
}

export async function deleteDivision(id: number): Promise<void> {
    const res = await fetch(`${DIRECTUS_URL}/items/division/${id}`, {
        method: "DELETE",
    });

    if (!res.ok) throw new Error("Delete division failed");
}
