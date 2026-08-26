import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const UPSTREAM_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

interface RawMemo {
    id: number;
    memo_no: string;
    subject: string;
    from: number;
    start_date: string;
    end_date: string;
    status: string;
    created_at?: string | null;
    created_by?: number | Record<string, unknown> | null;
    approved_by?: number | Record<string, unknown> | null;
}

interface MemoRelationCompany {
    company_memo_id: number;
    company_id: number;
}

interface MemoRelationAttachment {
    id: number;
    company_memo_id: number;
    file_url: string;
    file_name: string;
}

export async function GET(req: NextRequest) {
    if (!UPSTREAM_BASE) {
        return NextResponse.json({ error: "Server Configuration Error" }, { status: 500 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    
    // Fetch all statuses, sorted by created_at descending
    let upstreamUrl = `${UPSTREAM_BASE.replace(/\/+$/, "")}/items/company_memo`;
    if (id) {
        upstreamUrl += `/${id}?fields=*,created_by.*,approved_by.*`;
    } else {
        upstreamUrl += `?limit=-1&fields=*,created_by.*,approved_by.*&sort=-created_at`;
    }

    const headers = new Headers();
    const token = process.env.DIRECTUS_STATIC_TOKEN;
    if (token) headers.set("Authorization", `Bearer ${token}`);

    // Fetch master memos, target companies mapping, and attachments mapping in parallel
    const [res, perRes, attsRes] = await Promise.all([
        fetch(upstreamUrl, { headers }),
        fetch(`${UPSTREAM_BASE.replace(/\/+$/, "")}/items/company_memo_per_companies?limit=-1`, { headers }),
        fetch(`${UPSTREAM_BASE.replace(/\/+$/, "")}/items/company_memo_attachments?limit=-1`, { headers })
    ]);

    if (!res.ok) {
        return NextResponse.json({ error: "Upstream Error" }, { status: res.status });
    }

    const [memoData, perData, attsData] = await Promise.all([
        res.json(),
        perRes.ok ? perRes.json() : { data: [] },
        attsRes.ok ? attsRes.json() : { data: [] }
    ]);

    const perCompanies = (perData.data || []) as MemoRelationCompany[];
    const attachmentsList = (attsData.data || []) as MemoRelationAttachment[];
    
    const normalizeItem = (item: RawMemo) => {
        const rawPerCompanies = perCompanies.filter((c) => Number(c.company_memo_id) === Number(item.id));
        const rawAttachments = attachmentsList.filter((att) => Number(att.company_memo_id) === Number(item.id));
        return {
            ...item,
            company_ids: rawPerCompanies.map((c) => Number(c.company_id)),
            attachments: rawAttachments.map((att) => ({
                id: att.id,
                company_memo_id: att.company_memo_id,
                file_url: att.file_url,
                file_name: att.file_name
            }))
        };
    };

    if (id) {
        if (!memoData.data || memoData.data.is_delete === 1) {
            return NextResponse.json({ error: "Memo not found" }, { status: 404 });
        }
        return NextResponse.json({ data: normalizeItem(memoData.data) });
    } else {
        return NextResponse.json({ data: (memoData.data || []).map(normalizeItem) });
    }
}
