import { NextRequest, NextResponse } from "next/server";

const DIRECTUS_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
const LIMIT = 1000;

const STATIC_TOKEN = process.env.DIRECTUS_STATIC_TOKEN;

async function dFetch(path: string, options?: RequestInit) {
    const res = await fetch(`${DIRECTUS_URL}${path}`, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${STATIC_TOKEN}`,
            ...(options?.headers || {}),
        },
    });

    if (!res.ok) {
        const text = await res.text();
        console.error("DIRECTUS ERROR:", text);
        try {
            return JSON.parse(text);
        } catch {
            throw new Error(text);
        }
    }

    if (res.status === 204) {
        return null;
    }

    return res.json();
}



interface RecordType {
    id: number;
    name: string;
    description: string | null;
    [key: string]: unknown;
}

interface Record {
    id: number;
    record_type_id: number;
    name: string;
    description: string | null;
    [key: string]: unknown;
}

export async function GET() {
    try {
        const [recordsRes, recordTypesRes] = await Promise.all([
            dFetch(`/items/employee_file_record_list?limit=${LIMIT}`),
            dFetch(`/items/employee_file_record_type?limit=${LIMIT}`),
        ]);

        if (recordsRes.error || recordTypesRes.error) {
            return NextResponse.json(
                { error: recordsRes.error || recordTypesRes.error },
                { status: 500 }
            );
        }

        const records = recordsRes.data || [];
        const recordTypes = recordTypesRes.data || [];

        const typeMap = new Map(recordTypes.map((t: RecordType) => [t.id, t]));

        const enriched = records.map((r: Record) => ({
            ...r,
            record_type: typeMap.get(r.record_type_id) || null,
        }));

        return NextResponse.json({ records: enriched, recordTypes });
    } catch (err: unknown) {
        return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    const body = await req.json();

    const created = await dFetch(`/items/employee_file_record_list`, {
        method: "POST",
        body: JSON.stringify(body),
    });

    return NextResponse.json({ success: true, data: created?.data });
}

export async function PATCH(req: NextRequest) {
    const body = await req.json();
    const { id, ...rest } = body;

    await dFetch(`/items/employee_file_record_list/${id}`, {
        method: "PATCH",
        body: JSON.stringify(rest),
    });

    return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
    const id = req.nextUrl.searchParams.get("id");

    await dFetch(`/items/employee_file_record_list/${id}`, {
        method: "DELETE",
    });

    return NextResponse.json({ success: true });
}
