import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

const DIRECTUS_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
const STATIC_TOKEN = process.env.DIRECTUS_STATIC_TOKEN;
const COOKIE_NAME = "vos_access_token";
const LIMIT = 1000;

function decodeJwtPayload(token: string) {
    try {
        const parts = token.split(".");
        if (parts.length < 2) return null;
        const p = parts[1];
        const b64 = p.replace(/-/g, "+").replace(/_/g, "/");
        const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
        const json = Buffer.from(padded, "base64").toString("utf8");
        return JSON.parse(json);
    } catch {
        return null;
    }
}

async function getUserId() {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;
    if (!token) return null;
    const payload = decodeJwtPayload(token);
    return payload?.id || payload?.user_id || payload?.sub || null;
}

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
            const parsed = JSON.parse(text);
            return { error: parsed };
        } catch {
            throw new Error(text);
        }
    }

    if (res.status === 204) {
        return null;
    }

    return res.json();
}

export async function GET() {
    try {
        const r = await dFetch(`/items/employee_file_record_type?limit=${LIMIT}&fields=*`);
        if (r.error) {
            return NextResponse.json({ error: r.error }, { status: 500 });
        }
        return NextResponse.json({ records: r.data || [] });
    } catch (err: unknown) {
        return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    const body = await req.json();
    const userId = await getUserId();

    const created = await dFetch(`/items/employee_file_record_type`, {
        method: "POST",
        body: JSON.stringify({
            ...body,
            created_by: userId,
            updated_by: userId,
        }),
    });

    return NextResponse.json({ success: true, data: created?.data });
}

export async function PATCH(req: NextRequest) {
    const body = await req.json();
    const { id, ...rest } = body;
    const userId = await getUserId();

    await dFetch(`/items/employee_file_record_type/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
            ...rest,
            updated_by: userId,
        }),
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
