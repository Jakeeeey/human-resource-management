import { NextRequest, NextResponse } from "next/server";

const DIRECTUS_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
const LIMIT = 50;

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

export async function GET(req: NextRequest) {
    try {
        const search = req.nextUrl.searchParams.get("search")?.trim();

        const filter = search
            ? `&filter[full_name][_icontains]=${encodeURIComponent(search)}`
            : "";

        const res = await dFetch(
            `/items/applicant?limit=${LIMIT}&sort=-created_at${filter}`
        );

        if (res.error) {
            return NextResponse.json({ error: res.error }, { status: 500 });
        }

        const applicants: { id: number }[] = res.data || [];

        let priorAttemptCount = 0;
        if (applicants.length) {
            const idList = applicants.map((a) => a.id).join(",");
            const countRes = await dFetch(
                `/items/quiz_attempt?filter[applicant_id][_in]=${idList}&aggregate[count]=*`
            );
            priorAttemptCount = Number(countRes?.data?.[0]?.count ?? 0);
        }

        return NextResponse.json({ applicants, priorAttemptCount });
    } catch (err: unknown) {
        return NextResponse.json(
            { error: err instanceof Error ? err.message : "Unknown error" },
            { status: 500 }
        );
    }
}

export async function POST(req: NextRequest) {
    const body = await req.json();
    const { full_name, position_applied_for } = body as {
        full_name: string;
        position_applied_for?: string | null;
    };

    if (!full_name || !full_name.trim()) {
        return NextResponse.json({ error: "full_name is required" }, { status: 400 });
    }

    const created = await dFetch(`/items/applicant`, {
        method: "POST",
        body: JSON.stringify({
            full_name: full_name.trim(),
            position_applied_for: position_applied_for?.trim() || null,
        }),
    });

    return NextResponse.json({ success: true, data: created?.data });
}
