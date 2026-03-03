import { NextRequest, NextResponse } from "next/server";

const DIRECTUS_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
if (!DIRECTUS_URL) {
    throw new Error("NEXT_PUBLIC_API_BASE_URL is not defined in environment variables");
}
const LIMIT = 1000;

async function dFetch(path: string, options?: RequestInit) {
    const token = process.env.DIRECTUS_STATIC_TOKEN || process.env.DIRECTUS_TOKEN || process.env.NEXT_PUBLIC_DIRECTUS_STATIC_TOKEN;
    const url = `${DIRECTUS_URL}${path}`;

    const res = await fetch(url, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            ...(token ? { "Authorization": `Bearer ${token}` } : {}),
            ...(options?.headers || {}),
        },
    });

    if (!res.ok) {
        const text = await res.text();
        console.error(`DIRECTUS ERROR [${url}]:`, text);
        throw new Error(text);
    }

    if (res.status === 204) {
        return null;
    }

    return res.json();
}

async function fetchAll(collection: string) {
    const r = await dFetch(`/items/${collection}?limit=${LIMIT}`);
    return r.data || [];
}

function cleanHead(v: unknown): number | null {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
}

async function getRelationsFiltered(req: NextRequest) {
    const search = req.nextUrl.searchParams.get("search");
    const divisionParam = req.nextUrl.searchParams.get("division");
    const fromParam = req.nextUrl.searchParams.get("from");
    const toParam = req.nextUrl.searchParams.get("to");

    const [departments, divisions, users, deptPositions] = await Promise.all([
        fetchAll("department"),
        fetchAll("division"),
        fetchAll("user"),
        fetchAll("positions"),
    ]);

    const uMap = new Map(users.map((u: Record<string, unknown>) => [u.user_id, u]));
    const posMap = new Map<number, Record<string, unknown>[]>();

    deptPositions.forEach((p: Record<string, unknown>) => {
        const deptId = p.department_id as number;
        if (!posMap.has(deptId)) posMap.set(deptId, []);
        posMap.get(deptId)!.push(p);
    });

    let result = departments.map((d: Record<string, unknown>) => {
        const headId = cleanHead(d.department_head);
        return {
            ...d,
            department_head_user: headId ? uMap.get(headId) || null : null,
            department_head_id: headId,
            positions: posMap.get(d.department_id as number) || [],
        };
    });

    if (search) {
        const s = search.toLowerCase();
        result = result.filter((d: Record<string, unknown>) =>
            (d.department_name as string)?.toLowerCase().includes(s)
        );
    }

    if (divisionParam) {
        const ids = divisionParam.split(",").map(Number);
        result = result.filter((d: Record<string, unknown>) =>
            ids.includes(Number(d.parent_division))
        );
    }

    if (fromParam) {
        const from = new Date(fromParam);
        result = result.filter((d: Record<string, unknown>) => new Date(d.date_added as string) >= from);
    }

    if (toParam) {
        const to = new Date(toParam);
        to.setHours(23, 59, 59, 999);
        result = result.filter((d: Record<string, unknown>) => new Date(d.date_added as string) <= to);
    }

    return { departments: result, divisions, users };
}

export async function GET(req: NextRequest) {
    return NextResponse.json(await getRelationsFiltered(req));
}

export async function POST(req: NextRequest) {
    const body = await req.json();
    const { positions = [], ...deptData } = body;

    const created = await dFetch(`/items/department`, {
        method: "POST",
        body: JSON.stringify({
            ...deptData,
            department_head: cleanHead(deptData.department_head),
        }),
    });

    if (!created?.data) {
        throw new Error("Department create failed Ã¢â‚¬â€ no data returned");
    }

    const deptId = created.data.department_id;

    for (const pos of positions) {
        await dFetch(`/items/positions`, {
            method: "POST",
            body: JSON.stringify({
                department_id: deptId,
                position: pos,
            }),
        });
    }

    return NextResponse.json({ success: true });
}



export async function PATCH(req: NextRequest) {
    const body = await req.json();
    const { department_id, positions = [], ...rest } = body;

    await dFetch(`/items/department/${department_id}`, {
        method: "PATCH",
        body: JSON.stringify({
            ...rest,
            department_head: cleanHead(rest.department_head),
        }),
    });

    // delete existing
    const existing = await fetchAll("positions");

    for (const p of existing.filter((x: Record<string, unknown>) => x.department_id === department_id)) {
        await dFetch(`/items/positions/${p.id}`, {
            method: "DELETE",
        });
    }

    // recreate
    for (const pos of positions) {
        await dFetch(`/items/positions`, {
            method: "POST",
            body: JSON.stringify({
                department_id,
                position: pos,
            }),
        });
    }

    return NextResponse.json({ success: true });
}


export async function DELETE(req: NextRequest) {
    const id = req.nextUrl.searchParams.get("id");

    const existing = await fetchAll("positions");

    for (const p of existing.filter((x: Record<string, unknown>) => x.department_id === Number(id))) {
        await dFetch(`/items/positions/${p.id}`, {
            method: "DELETE",
        });
    }

    await dFetch(`/items/department/${id}`, { method: "DELETE" });

    return NextResponse.json({ success: true });
}



