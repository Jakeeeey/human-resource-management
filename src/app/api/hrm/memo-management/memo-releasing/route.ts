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

interface CompanyCredentials {
    company_id: number;
    company_name: string;
    company_code: string;
    directus?: string;
    directus_token?: string;
}

interface RawMemo {
    id: number;
    memo_no: string;
    subject: string;
    from: number;
    start_date: string;
    end_date: string;
    status: string;
    body?: string | null;
    created_at?: string | null;
    created_by?: number | Record<string, unknown> | null;
    updated_at?: string | null;
    updated_by?: number | Record<string, unknown> | null;
    approved_by?: number | Record<string, unknown> | null;
    approved_at?: string | null;
    released_by?: number | Record<string, unknown> | null;
    released_at?: string | null;
    synced_companies_count?: number;
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

// Fetch all companies from main database to get remote credentials
async function fetchCompaniesList(): Promise<CompanyCredentials[]> {
    if (!UPSTREAM_BASE) return [];
    try {
        const res = await fetch(`${UPSTREAM_BASE.replace(/\/+$/, "")}/items/company_list?limit=-1`, {
            headers: {
                "Authorization": `Bearer ${process.env.DIRECTUS_STATIC_TOKEN}`
            }
        });
        if (!res.ok) return [];
        const json = await res.json();
        return (json.data || []) as CompanyCredentials[];
    } catch (e) {
        console.error("Error fetching company list details:", e);
        return [];
    }
}

export async function GET(req: NextRequest) {
    if (!UPSTREAM_BASE) {
        return NextResponse.json({ error: "Server Configuration Error" }, { status: 500 });
    }

    const { searchParams } = new URL(req.url);
    const memoNo = searchParams.get("memo_no");

    let upstreamUrl = `${UPSTREAM_BASE.replace(/\/+$/, "")}/items/company_memo?filter[status][_in]=Approved,Partially Released&filter[is_delete][_eq]=0&fields=*,created_by.*,approved_by.*&sort=-approved_at`;
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
        console.error("GET approved memos failed:", e);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

export async function PATCH(req: NextRequest) {
    if (!UPSTREAM_BASE) {
        return NextResponse.json({ error: "Server Configuration Error" }, { status: 500 });
    }

    try {
        const body = await req.json();
        const { memo_no, action, company_id } = body;

        if (!memo_no) {
            return NextResponse.json({ error: "Missing memo_no parameter" }, { status: 400 });
        }

        // Get current user ID and email
        const cookieStore = await cookies();
        const tokenVal = cookieStore.get("vos_access_token")?.value;
        let userId: number | null = null;
        let userEmail: string | null = null;
        if (tokenVal) {
            const payload = decodeJwtPayload(tokenVal);
            if (payload) {
                if (payload.sub) {
                    const parsed = parseInt(String(payload.sub), 10);
                    if (!isNaN(parsed)) userId = parsed;
                }
                if (payload.email) {
                    userEmail = String(payload.email);
                }
            }
        }
        const phTime = getPhilippineTime();

        // Query main database record for this memo_no
        const mainMemosRes = await fetch(
            `${UPSTREAM_BASE.replace(/\/+$/, "")}/items/company_memo?filter[memo_no][_eq]=${memo_no}&limit=1`,
            {
                headers: { "Authorization": `Bearer ${process.env.DIRECTUS_STATIC_TOKEN}` }
            }
        );
        if (!mainMemosRes.ok) {
            return NextResponse.json({ error: "Failed to find local memo" }, { status: 400 });
        }

        const { data: mainMemos } = await mainMemosRes.json();
        if (!mainMemos || mainMemos.length === 0) {
            return NextResponse.json({ error: "Local memo not found" }, { status: 404 });
        }
        const memo = mainMemos[0];

        // Fetch relations
        const [perCompaniesRes, attachmentsRes] = await Promise.all([
            fetch(`${UPSTREAM_BASE.replace(/\/+$/, "")}/items/company_memo_per_companies?filter[company_memo_id][_eq]=${memo.id}&limit=-1`, {
                headers: { "Authorization": `Bearer ${process.env.DIRECTUS_STATIC_TOKEN}` }
            }),
            fetch(`${UPSTREAM_BASE.replace(/\/+$/, "")}/items/company_memo_attachments?filter[company_memo_id][_eq]=${memo.id}&limit=-1`, {
                headers: { "Authorization": `Bearer ${process.env.DIRECTUS_STATIC_TOKEN}` }
            })
        ]);

        const oldPerCompanies = perCompaniesRes.ok ? (await perCompaniesRes.json()).data || [] as MemoRelationCompany[] : [] as MemoRelationCompany[];
        const oldAttachments = attachmentsRes.ok ? (await attachmentsRes.json()).data || [] as MemoRelationAttachment[] : [] as MemoRelationAttachment[];

        const targetCompanyIds = (oldPerCompanies as MemoRelationCompany[]).map((c) => Number(c.company_id));
        const localAttachments = (oldAttachments as MemoRelationAttachment[]).map((att) => ({ file_url: att.file_url, file_name: att.file_name }));

        if (action === "release_local") {
            // Update local status
            const patchRes = await fetch(`${UPSTREAM_BASE.replace(/\/+$/, "")}/items/company_memo/${memo.id}`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${process.env.DIRECTUS_STATIC_TOKEN}`
                },
                body: JSON.stringify({
                    status: "Released",
                    updated_by: userId,
                    updated_at: phTime,
                    released_by: userId,
                    released_at: phTime
                })
            });

            if (!patchRes.ok) {
                return NextResponse.json({ error: "Failed to update local status to Released" }, { status: 500 });
            }

            return NextResponse.json({
                success: true,
                company_ids: targetCompanyIds
            });
        }

        if (action === "update_sync_status") {
            const { success_count, status } = body;
            if (success_count === undefined || !status) {
                return NextResponse.json({ error: "Missing success_count or status parameters" }, { status: 400 });
            }

            const patchRes = await fetch(`${UPSTREAM_BASE.replace(/\/+$/, "")}/items/company_memo/${memo.id}`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${process.env.DIRECTUS_STATIC_TOKEN}`
                },
                body: JSON.stringify({
                    status: status,
                    synced_companies_count: success_count,
                    updated_by: userId,
                    updated_at: phTime
                })
            });

            if (!patchRes.ok) {
                return NextResponse.json({ error: "Failed to update sync status" }, { status: 500 });
            }

            return NextResponse.json({ success: true });
        }

        if (action === "sync_company") {
            if (!company_id) {
                return NextResponse.json({ error: "Missing company_id parameter" }, { status: 400 });
            }

            const companiesList = await fetchCompaniesList();
            const company = companiesList.find(c => Number(c.company_id) === Number(company_id));

            if (!company) {
                return NextResponse.json({ error: `Company credentials not found for ID ${company_id}` }, { status: 404 });
            }

            if (!company.directus || !company.directus_token) {
                return NextResponse.json({ error: `Directus credentials incomplete for ${company.company_name}` }, { status: 400 });
            }

            const directusUrl = company.directus;
            const directusToken = company.directus_token;

            // Resolve remote user ID by email
            let remoteUserId: number | null = null;
            if (userEmail) {
                try {
                    const userRes = await fetch(
                        `${directusUrl.replace(/\/+$/, "")}/items/user?filter[user_email][_eq]=${encodeURIComponent(userEmail)}&limit=1`,
                        {
                            headers: { "Authorization": `Bearer ${directusToken}` }
                        }
                    );
                    if (userRes.ok) {
                        const userJson = await userRes.json();
                        if (userJson && userJson.data && userJson.data.length > 0) {
                            remoteUserId = Number(userJson.data[0].user_id);
                        }
                    }
                } catch (e) {
                    console.error(`Failed to resolve remote user for email ${userEmail}:`, e);
                }
            }

            // Sync to remote
            // Check if remote memo exists by memo_no
            const remoteMemoGet = await fetch(
                `${directusUrl.replace(/\/+$/, "")}/items/company_memo?filter[memo_no][_eq]=${memo_no}&limit=1`,
                {
                    headers: { "Authorization": `Bearer ${directusToken}` }
                }
            );

            if (!remoteMemoGet.ok) {
                const errDetail = await remoteMemoGet.json().catch(() => ({}));
                console.error("GET Remote Memo Error:", errDetail);
                return NextResponse.json({ 
                    error: `Could not verify remote memo on ${company.company_name}`,
                    details: errDetail 
                }, { status: 500 });
            }

            const remoteMemos = (await remoteMemoGet.json()).data;
            if (remoteMemos && remoteMemos.length > 0) {
                const remoteMemo = remoteMemos[0];

                // PATCH existing remote memo
                const patchRemoteRes = await fetch(
                    `${directusUrl.replace(/\/+$/, "")}/items/company_memo/${remoteMemo.id}`,
                    {
                        method: "PATCH",
                        headers: {
                            "Content-Type": "application/json",
                            "Authorization": `Bearer ${directusToken}`
                        },
                        body: JSON.stringify({
                            status: "Released",
                            updated_by: remoteUserId,
                            updated_at: phTime,
                            released_by: remoteUserId,
                            released_at: phTime
                        })
                    }
                );

                if (!patchRemoteRes.ok) {
                    const errDetail = await patchRemoteRes.json().catch(() => ({}));
                    console.error("PATCH Remote Memo Error:", errDetail);
                    return NextResponse.json({ 
                        error: `Failed to update status on ${company.company_name}`,
                        details: errDetail
                    }, { status: 500 });
                }
            } else {
                // Create remote memo via POST
                const remoteMemoRes = await fetch(`${directusUrl.replace(/\/+$/, "")}/items/company_memo`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${directusToken}`
                    },
                    body: JSON.stringify({
                        memo_no: memo_no,
                        subject: memo.subject,
                        body: memo.body,
                        from: memo.from,
                        start_date: memo.start_date,
                        end_date: memo.end_date,
                        status: "Released",
                        created_by: remoteUserId,
                        created_at: phTime,
                        released_by: remoteUserId,
                        released_at: phTime,
                        updated_by: remoteUserId,
                        updated_at: phTime
                    })
                });

                if (!remoteMemoRes.ok) {
                    const errDetail = await remoteMemoRes.json().catch(() => ({}));
                    console.error("POST Remote Memo Error:", errDetail);
                    return NextResponse.json({ 
                        error: `Failed to insert record on ${company.company_name}`,
                        details: errDetail
                    }, { status: 500 });
                }

                const createdRemote = await remoteMemoRes.json();
                const remoteMemoId = createdRemote.data.id;

                // Sync attachments remotely
                if (localAttachments.length > 0) {
                    await Promise.all(localAttachments.map((file) => {
                        return fetch(`${directusUrl.replace(/\/+$/, "")}/items/company_memo_attachments`, {
                            method: "POST",
                            headers: {
                                "Content-Type": "application/json",
                                "Authorization": `Bearer ${directusToken}`
                            },
                            body: JSON.stringify({
                                company_memo_id: remoteMemoId,
                                file_url: file.file_url,
                                file_name: file.file_name
                            })
                        });
                    }));
                }

                // Sync target companies mapping remotely
                await Promise.all(targetCompanyIds.map((id: number) => {
                    return fetch(`${directusUrl.replace(/\/+$/, "")}/items/company_memo_per_companies`, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            "Authorization": `Bearer ${directusToken}`
                        },
                        body: JSON.stringify({
                            company_memo_id: remoteMemoId,
                            company_id: id
                        })
                    });
                }));
            }

            return NextResponse.json({ success: true });
        }

        return NextResponse.json({ error: "Invalid action parameter" }, { status: 400 });
    } catch (e) {
        console.error("PATCH releasing handler failed:", e);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
