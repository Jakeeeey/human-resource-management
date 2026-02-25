import { NextRequest, NextResponse } from "next/server";

const DIRECTUS_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
const LIMIT = 1000;

async function dFetch(path: string, options?: RequestInit) {
    const res = await fetch(`${DIRECTUS_URL}${path}`, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            ...(options?.headers || {}),
        },
    });

    if (!res.ok) {
        const text = await res.text();
        console.error("DIRECTUS ERROR:", text);
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

export async function GET() {
    const records = await fetchAll("employee_file_record_type");
    return NextResponse.json({ records });
}

export async function POST(req: NextRequest) {
    const body = await req.json();

    const created = await dFetch(`/items/employee_file_record_type`, {
        method: "POST",
        body: JSON.stringify(body),
    });

    return NextResponse.json({ success: true, data: created?.data });
}

export async function PATCH(req: NextRequest) {
    const body = await req.json();
    const { id, ...rest } = body;

    await dFetch(`/items/employee_file_record_type/${id}`, {
        method: "PATCH",
        body: JSON.stringify(rest),
    });

    return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
    const id = req.nextUrl.searchParams.get("id");

    await dFetch(`/items/employee_file_record_type/${id}`, {
        method: "DELETE",
    });

    return NextResponse.json({ success: true });
}
