import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export const runtime = "nodejs";

const UPSTREAM_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

function decodeJwtPayload(token: string): Record<string, unknown> | null {
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

function getPhilippineTime(): string {
    return new Date().toLocaleString("sv-SE", { timeZone: "Asia/Manila" }).replace("T", " ");
}

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
    const memoNo = searchParams.get("memo_no");

    let upstreamUrl = `${UPSTREAM_BASE.replace(/\/+$/, "")}/items/company_memo?filter[status][_eq]=Submitted&fields=*,created_by.*&sort=-created_at`;
    if (memoNo) {
        upstreamUrl += `&filter[memo_no][_contains]=${encodeURIComponent(memoNo)}`;
    }

    const headers = new Headers();
    const token = process.env.DIRECTUS_STATIC_TOKEN;
    if (token) headers.set("Authorization", `Bearer ${token}`);

    try {
        // Fetch memos, target companies mapping, and attachments mapping in parallel
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

        const memos = ((memoData.data || []) as RawMemo[]).map((item) => {
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
        });

        return NextResponse.json({ data: memos });
    } catch (e) {
        console.error("GET memos failed:", e);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

export async function PATCH(req: NextRequest) {
    if (!UPSTREAM_BASE) {
        return NextResponse.json({ error: "Server Configuration Error" }, { status: 500 });
    }

    try {
        const body = await req.json();
        const { memo_nos, action } = body;

        if (!memo_nos || !Array.isArray(memo_nos) || memo_nos.length === 0) {
            return NextResponse.json({ error: "Missing memo_nos parameter" }, { status: 400 });
        }

        if (action !== "approve" && action !== "reject") {
            return NextResponse.json({ error: "Invalid action parameter" }, { status: 400 });
        }

        // Get current user ID
        const cookieStore = await cookies();
        const tokenVal = cookieStore.get("vos_access_token")?.value;
        let userId: number | null = null;
        if (tokenVal) {
            const payload = decodeJwtPayload(tokenVal);
            if (payload && payload.sub) {
                const parsed = parseInt(String(payload.sub), 10);
                if (!isNaN(parsed)) userId = parsed;
            }
        }
        const phTime = getPhilippineTime();

        const failedCompanies: string[] = [];

        for (const memoNo of memo_nos) {
            // Query main database record for this memo_no
            const mainMemosRes = await fetch(
                `${UPSTREAM_BASE.replace(/\/+$/, "")}/items/company_memo?filter[memo_no][_eq]=${memoNo}&limit=1`,
                {
                    headers: { "Authorization": `Bearer ${process.env.DIRECTUS_STATIC_TOKEN}` }
                }
            );
            if (!mainMemosRes.ok) continue;

            const { data: mainMemos } = await mainMemosRes.json();
            if (!mainMemos || mainMemos.length === 0) continue;
            const memo = mainMemos[0];

            if (action === "approve") {
                // Approve locally only
                await fetch(`${UPSTREAM_BASE.replace(/\/+$/, "")}/items/company_memo/${memo.id}`, {
                    method: "PATCH",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${process.env.DIRECTUS_STATIC_TOKEN}`
                    },
                    body: JSON.stringify({
                        status: "Approved",
                        approved_by: userId,
                        approved_at: phTime
                    })
                });
            } else if (action === "reject") {
                // Reject locally: set status to Rejected so creators see it as Rejected and can edit it
                await fetch(`${UPSTREAM_BASE.replace(/\/+$/, "")}/items/company_memo/${memo.id}`, {
                    method: "PATCH",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${process.env.DIRECTUS_STATIC_TOKEN}`
                    },
                    body: JSON.stringify({
                        status: "Rejected",
                        rejected_by: userId,
                        rejected_at: phTime
                    })
                });
            }
        }

        return NextResponse.json({
            success: true,
            failedCompanies
        });
    } catch (e) {
        console.error("PATCH approval handler failed:", e);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
