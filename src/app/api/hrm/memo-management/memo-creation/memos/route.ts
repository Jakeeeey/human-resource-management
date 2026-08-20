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
    is_mother_company?: number | null;
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
    company_memo_per_companies?: { company_id: number }[];
}

interface MemoRelationCompany {
    id?: number;
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

// Atomically calculate sequence ID on main database
async function getNextSequence(): Promise<number> {
    if (!UPSTREAM_BASE) return 1;
    try {
        const dateObj = new Date();
        const year = dateObj.getFullYear();
        const month = String(dateObj.getMonth() + 1).padStart(2, "0");
        const date = String(dateObj.getDate()).padStart(2, "0");
        const datePrefix = `${year}${month}${date}`;
        
        const listRes = await fetch(
            `${UPSTREAM_BASE.replace(/\/+$/, "")}/items/company_memo?filter[memo_no][_starts_with]=MM-${datePrefix}-&sort=-memo_no&limit=1`,
            {
                headers: {
                    "Authorization": `Bearer ${process.env.DIRECTUS_STATIC_TOKEN}`
                }
            }
        );
        let nextSequence = 1;
        if (listRes.ok) {
            const { data: listData } = await listRes.json();
            if (listData && listData.length > 0) {
                const latestId = listData[0].memo_no;
                const seqStr = latestId.split("-").pop();
                if (seqStr) {
                    nextSequence = parseInt(seqStr, 10) + 1;
                }
            }
        }
        return nextSequence;
    } catch {
        return 1;
    }
}

async function handleGet(req: NextRequest) {
    if (!UPSTREAM_BASE) {
        return NextResponse.json({ error: "Server Configuration Error" }, { status: 500 });
    }
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    
    let upstreamUrl = `${UPSTREAM_BASE.replace(/\/+$/, "")}/items/company_memo`;
    if (id) {
        upstreamUrl += `/${id}?fields=*,created_by.*`;
    } else {
        upstreamUrl += `?limit=-1&fields=*,created_by.*&filter[status][_eq]=Draft`;
    }

    const queryParams = new URLSearchParams(searchParams);
    queryParams.delete("id");
    queryParams.delete("fields");
    queryParams.delete("limit");

    const memoNo = queryParams.get("memo_no");
    if (memoNo) {
        upstreamUrl += `&filter[memo_no][_contains]=${encodeURIComponent(memoNo)}`;
        queryParams.delete("memo_no");
    }
    
    const queryString = queryParams.toString();
    if (queryString) {
        upstreamUrl += (upstreamUrl.includes("?") ? "&" : "?") + queryString;
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
    
    // Normalize data structure for the client side
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
        return NextResponse.json({ data: normalizeItem(memoData.data) });
    } else {
        return NextResponse.json({ data: (memoData.data || []).map(normalizeItem) });
    }
}

async function handlePost(req: NextRequest) {
    if (!UPSTREAM_BASE) {
        return NextResponse.json({ error: "Server Configuration Error" }, { status: 500 });
    }
    
    const body = await req.json();
    const { subject, body: memoBody, from, start_date, end_date, company_ids, attachments } = body;

    if (!from) {
        return NextResponse.json({ error: "Missing from company" }, { status: 400 });
    }
    if (!company_ids || company_ids.length === 0) {
        return NextResponse.json({ error: "Missing company_ids" }, { status: 400 });
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
    
    // Generate unified memo_no
    const nextSeq = await getNextSequence();
    const dateObj = new Date();
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, "0");
    const date = String(dateObj.getDate()).padStart(2, "0");
    const datePrefix = `${year}${month}${date}`;
    const memo_no = `MM-${datePrefix}-${String(nextSeq).padStart(3, "0")}`;

    // 1. Save Locally (Main Directus - Single Master Record)
    let masterMemoId: number | null = null;
    try {
        const mainMemoRes = await fetch(`${UPSTREAM_BASE.replace(/\/+$/, "")}/items/company_memo`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${process.env.DIRECTUS_STATIC_TOKEN}`
            },
            body: JSON.stringify({
                memo_no,
                subject,
                body: memoBody,
                from,
                start_date,
                end_date,
                status: "Draft",
                created_by: userId,
                created_at: phTime,
                updated_by: userId,
                updated_at: phTime
            })
        });

        if (mainMemoRes.ok) {
            const createdMain = await mainMemoRes.json();
            masterMemoId = createdMain.data.id;

            // Save local attachments linked to masterMemoId
            if (attachments && (attachments as { file_url: string; file_name: string }[]).length > 0) {
                await Promise.all((attachments as { file_url: string; file_name: string }[]).map((file) => {
                    return fetch(`${UPSTREAM_BASE.replace(/\/+$/, "")}/items/company_memo_attachments`, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            "Authorization": `Bearer ${process.env.DIRECTUS_STATIC_TOKEN}`
                        },
                        body: JSON.stringify({
                            company_memo_id: masterMemoId,
                            file_url: file.file_url,
                            file_name: file.file_name
                        })
                    });
                }));
            }

            // Save local targeted companies mapping to masterMemoId
            await Promise.all(company_ids.map((cId: number) => {
                return fetch(`${UPSTREAM_BASE.replace(/\/+$/, "")}/items/company_memo_per_companies`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${process.env.DIRECTUS_STATIC_TOKEN}`
                    },
                    body: JSON.stringify({
                        company_memo_id: masterMemoId,
                        company_id: cId
                    })
                });
            }));
        } else {
            const errText = await mainMemoRes.text();
            console.error("Local save failed:", errText);
            return NextResponse.json({ error: "Failed to create memo on local hub", details: errText }, { status: 500 });
        }
    } catch (e) {
        console.error("Local save connection error:", e);
        return NextResponse.json({ error: "Local save connection error" }, { status: 500 });
    }

    return NextResponse.json({
        success: true,
        data: { id: masterMemoId, memo_no },
        failedCompanies: []
    });
}

async function handlePatch(req: NextRequest) {
    if (!UPSTREAM_BASE) {
        return NextResponse.json({ error: "Server Configuration Error" }, { status: 500 });
    }
    const { searchParams } = new URL(req.url);
    const memoNo = searchParams.get("memo_no");

    if (!memoNo) {
        return NextResponse.json({ error: "Missing memo_no parameter" }, { status: 400 });
    }

    const body = await req.json();
    const { subject, body: memoBody, start_date, end_date, status, company_ids, attachments } = body;

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
        `${UPSTREAM_BASE.replace(/\/+$/, "")}/items/company_memo?filter[memo_no][_eq]=${memoNo}&limit=1`,
        {
            headers: {
                "Authorization": `Bearer ${process.env.DIRECTUS_STATIC_TOKEN}`
            }
        }
    );
    if (!mainMemosRes.ok) {
        return NextResponse.json({ error: "Memo not found locally" }, { status: 404 });
    }
    const { data: mainMemos } = await mainMemosRes.json();
    if (!mainMemos || mainMemos.length === 0) {
        return NextResponse.json({ error: "Memo not found locally" }, { status: 404 });
    }
    const memo = mainMemos[0];

    // Query target companies and attachments mapping manually to bypass Directus schema cache
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

    const companiesList = await fetchCompaniesList();
    const failedCompanies: string[] = [];

    const senderCompany = companiesList.find(c => Number(c.company_id) === Number(memo.from));
    const isMother = Number(senderCompany?.is_mother_company) === 1;

    let statusToSave = status || memo.status;
    if (status === "Submitted" && isMother) {
        statusToSave = "Approved";
    }

    // 1. Update Locally (Main Directus)
    try {
        await fetch(`${UPSTREAM_BASE.replace(/\/+$/, "")}/items/company_memo/${memo.id}`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${process.env.DIRECTUS_STATIC_TOKEN}`
            },
            body: JSON.stringify({
                subject,
                body: memoBody,
                start_date,
                end_date,
                status: statusToSave,
                updated_by: userId,
                updated_at: phTime
            })
        });

        // Sync Target Companies locally
        if (company_ids) {
            // Delete old mappings
            await Promise.all((oldPerCompanies as MemoRelationCompany[]).map((c) => {
                return fetch(`${UPSTREAM_BASE.replace(/\/+$/, "")}/items/company_memo_per_companies/${c.id}`, {
                    method: "DELETE",
                    headers: {
                        "Authorization": `Bearer ${process.env.DIRECTUS_STATIC_TOKEN}`
                    }
                });
            }));

            // Insert new mappings
            await Promise.all(company_ids.map((cId: number) => {
                return fetch(`${UPSTREAM_BASE.replace(/\/+$/, "")}/items/company_memo_per_companies`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${process.env.DIRECTUS_STATIC_TOKEN}`
                    },
                    body: JSON.stringify({
                        company_memo_id: memo.id,
                        company_id: cId
                    })
                });
            }));
        }

        // Sync Attachments locally
        if (attachments) {
            // Delete old
            await Promise.all((oldAttachments as MemoRelationAttachment[]).map((att) => {
                return fetch(`${UPSTREAM_BASE.replace(/\/+$/, "")}/items/company_memo_attachments/${att.id}`, {
                    method: "DELETE",
                    headers: {
                        "Authorization": `Bearer ${process.env.DIRECTUS_STATIC_TOKEN}`
                    }
                });
            }));

            // Insert current
            await Promise.all((attachments as { file_url: string; file_name: string }[]).map((file) => {
                return fetch(`${UPSTREAM_BASE.replace(/\/+$/, "")}/items/company_memo_attachments`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${process.env.DIRECTUS_STATIC_TOKEN}`
                    },
                    body: JSON.stringify({
                        company_memo_id: memo.id,
                        file_url: file.file_url,
                        file_name: file.file_name
                    })
                });
            }));
        }
    } catch (e) {
        console.error("Local patch failed", e);
    }

    // 2. Update Remotely (Propagate/Sync only if it is Approved now or was already Approved)
    const shouldPropagate = (status === "Submitted" && isMother) || (status === "Approved") || (memo.status === "Approved");

    if (shouldPropagate) {
        const currentCompanyIds = company_ids ? company_ids.map(Number) : targetCompanyIds;
        const removedCompanyIds = targetCompanyIds.filter((id: number) => !currentCompanyIds.includes(id));

        // Delete remote memos for companies that were deselected/removed
        for (const cId of removedCompanyIds) {
            const company = companiesList.find(c => Number(c.company_id) === Number(cId));

            if (company && company.directus && company.directus_token) {
                try {
                    const remoteMemoGet = await fetch(
                        `${company.directus.replace(/\/+$/, "")}/items/company_memo?filter[memo_no][_eq]=${memoNo}&fields=id&limit=1`,
                        {
                            headers: {
                                "Authorization": `Bearer ${company.directus_token}`
                            }
                        }
                    );

                    if (remoteMemoGet.ok) {
                        const remoteMemos = (await remoteMemoGet.json()).data;
                        if (remoteMemos && remoteMemos.length > 0) {
                            const remoteMemo = remoteMemos[0];

                            // Delete remote memo (will cascade delete attachments and target relations remotely)
                            await fetch(
                                `${company.directus.replace(/\/+$/, "")}/items/company_memo/${remoteMemo.id}`,
                                {
                                    method: "DELETE",
                                    headers: {
                                        "Authorization": `Bearer ${company.directus_token}`
                                    }
                                }
                            );
                        }
                    }
                } catch (err) {
                    console.error(`Failed to delete remote memo for deselected company ${company.company_name}:`, err);
                }
            }
        }

        // Add or update remote memos for current target companies
        for (const cId of currentCompanyIds) {
            const company = companiesList.find(c => Number(c.company_id) === Number(cId));

            if (company && company.directus && company.directus_token) {
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

                try {
                    // Fetch remote memo row by memo_no
                    const remoteMemoGet = await fetch(
                        `${directusUrl.replace(/\/+$/, "")}/items/company_memo?filter[memo_no][_eq]=${memoNo}&limit=1`,
                        {
                            headers: {
                                "Authorization": `Bearer ${directusToken}`
                            }
                        }
                    );

                    if (remoteMemoGet.ok) {
                        const remoteMemos = (await remoteMemoGet.json()).data;
                        if (remoteMemos && remoteMemos.length > 0) {
                            const remoteMemo = remoteMemos[0];

                            // Patch remote memo
                            const patchRemoteRes = await fetch(
                                `${directusUrl.replace(/\/+$/, "")}/items/company_memo/${remoteMemo.id}`,
                                {
                                    method: "PATCH",
                                    headers: {
                                        "Content-Type": "application/json",
                                        "Authorization": `Bearer ${directusToken}`
                                    },
                                    body: JSON.stringify({
                                        subject,
                                        body: memoBody,
                                        start_date,
                                        end_date,
                                        status: statusToSave,
                                        updated_by: remoteUserId,
                                        updated_at: phTime
                                    })
                                }
                            );

                            if (patchRemoteRes.ok) {
                                // Sync remote attachments
                                if (attachments) {
                                    const getOldRemoteRes = await fetch(
                                        `${directusUrl.replace(/\/+$/, "")}/items/company_memo_attachments?filter[company_memo_id][_eq]=${remoteMemo.id}&limit=-1`,
                                        {
                                            headers: {
                                                "Authorization": `Bearer ${directusToken}`
                                            }
                                        }
                                    );
                                    if (getOldRemoteRes.ok) {
                                        const oldRemoteAtts = (await getOldRemoteRes.json()).data as MemoRelationAttachment[];
                                        await Promise.all(oldRemoteAtts.map((att) => {
                                            return fetch(`${directusUrl.replace(/\/+$/, "")}/items/company_memo_attachments/${att.id}`, {
                                                method: "DELETE",
                                                headers: {
                                                    "Authorization": `Bearer ${directusToken}`
                                                }
                                            });
                                        }));
                                    }

                                    // Insert current attachments remote
                                    await Promise.all((attachments as { file_url: string; file_name: string }[]).map((file) => {
                                        return fetch(`${directusUrl.replace(/\/+$/, "")}/items/company_memo_attachments`, {
                                            method: "POST",
                                            headers: {
                                                "Content-Type": "application/json",
                                                "Authorization": `Bearer ${directusToken}`
                                            },
                                            body: JSON.stringify({
                                                company_memo_id: remoteMemo.id,
                                                file_url: file.file_url,
                                                file_name: file.file_name
                                            })
                                        });
                                    }));
                                }

                                // Sync remote target companies mapping (so receiver has the updated list)
                                if (company_ids) {
                                    const getOldRemotePerRes = await fetch(
                                        `${directusUrl.replace(/\/+$/, "")}/items/company_memo_per_companies?filter[company_memo_id][_eq]=${remoteMemo.id}&limit=-1`,
                                        {
                                            headers: {
                                                "Authorization": `Bearer ${directusToken}`
                                            }
                                        }
                                    );
                                    if (getOldRemotePerRes.ok) {
                                        const oldRemotePers = (await getOldRemotePerRes.json()).data as MemoRelationCompany[];
                                        await Promise.all(oldRemotePers.map((p) => {
                                            return fetch(`${directusUrl.replace(/\/+$/, "")}/items/company_memo_per_companies/${p.id}`, {
                                                method: "DELETE",
                                                headers: {
                                                    "Authorization": `Bearer ${directusToken}`
                                                }
                                            });
                                        }));
                                    }

                                    await Promise.all(currentCompanyIds.map((id: number) => {
                                        return fetch(`${directusUrl.replace(/\/+$/, "")}/items/company_memo_per_companies`, {
                                            method: "POST",
                                            headers: {
                                                "Content-Type": "application/json",
                                                "Authorization": `Bearer ${directusToken}`
                                            },
                                            body: JSON.stringify({
                                                company_memo_id: remoteMemo.id,
                                                company_id: id
                                            })
                                        });
                                    }));
                                }
                            } else {
                                failedCompanies.push(company.company_name);
                            }
                        } else {
                            // Remote memo does NOT exist -> Create/POST it!
                            const remoteMemoRes = await fetch(`${directusUrl.replace(/\/+$/, "")}/items/company_memo`, {
                                method: "POST",
                                headers: {
                                    "Content-Type": "application/json",
                                    "Authorization": `Bearer ${directusToken}`
                                },
                                body: JSON.stringify({
                                    memo_no: memoNo,
                                    subject: subject || memo.subject,
                                    body: memoBody || memo.body,
                                    from: memo.from,
                                    start_date: start_date || memo.start_date,
                                    end_date: end_date || memo.end_date,
                                    status: statusToSave,
                                    created_by: remoteUserId,
                                    created_at: phTime,
                                    updated_by: remoteUserId,
                                    updated_at: phTime
                                })
                            });

                            if (remoteMemoRes.ok) {
                                const createdRemote = await remoteMemoRes.json();
                                const remoteMemoId = createdRemote.data.id;

                                // Sync remote attachments
                                const currentAttachments = attachments || localAttachments;
                                if (currentAttachments && currentAttachments.length > 0) {
                                    await Promise.all((currentAttachments as { file_url: string; file_name: string }[]).map((file) => {
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

                                // Sync remote association target companies
                                await Promise.all(currentCompanyIds.map((id: number) => {
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
                            } else {
                                failedCompanies.push(company.company_name + " (Failed to create remotely)");
                            }
                        }
                    } else {
                        failedCompanies.push(company.company_name);
                    }
                } catch (err) {
                    console.error(`Failed to patch remote Directus for ${company.company_name}:`, err);
                    failedCompanies.push(company.company_name);
                }
            }
        }
    }

    return NextResponse.json({
        success: true,
        failedCompanies
    });
}

async function handleDelete(req: NextRequest) {
    if (!UPSTREAM_BASE) {
        return NextResponse.json({ error: "Server Configuration Error" }, { status: 500 });
    }
    const { searchParams } = new URL(req.url);
    const memoNo = searchParams.get("memo_no");

    if (!memoNo) {
        return NextResponse.json({ error: "Missing memo_no parameter" }, { status: 400 });
    }

    // Query main database record
    const mainMemosRes = await fetch(
        `${UPSTREAM_BASE.replace(/\/+$/, "")}/items/company_memo?filter[memo_no][_eq]=${memoNo}&fields=*,company_memo_per_companies.*&limit=1`,
        {
            headers: {
                "Authorization": `Bearer ${process.env.DIRECTUS_STATIC_TOKEN}`
            }
        }
    );
    if (!mainMemosRes.ok) {
         return NextResponse.json({ error: "Memo not found locally" }, { status: 404 });
    }
    const { data: mainMemos } = await mainMemosRes.json();
    if (!mainMemos || mainMemos.length === 0) {
        return NextResponse.json({ error: "Memo not found locally" }, { status: 404 });
    }
    const memo = mainMemos[0] as RawMemo;
    const targetCompanyIds = (memo.company_memo_per_companies || []).map((c) => Number(c.company_id));

    const companiesList = await fetchCompaniesList();
    const failedCompanies: string[] = [];

    // 1. Delete Remotely
    for (const cId of targetCompanyIds) {
        const company = companiesList.find(c => Number(c.company_id) === Number(cId));

        if (company && company.directus && company.directus_token) {
            const directusUrl = company.directus;
            const directusToken = company.directus_token;
            try {
                const remoteMemoGet = await fetch(
                    `${directusUrl.replace(/\/+$/, "")}/items/company_memo?filter[memo_no][_eq]=${memoNo}&limit=1`,
                    {
                        headers: {
                            "Authorization": `Bearer ${directusToken}`
                        }
                    }
                );

                if (remoteMemoGet.ok) {
                    const remoteMemos = (await remoteMemoGet.json()).data;
                    if (remoteMemos && remoteMemos.length > 0) {
                        const remoteMemo = remoteMemos[0];

                        // Fetch remote attachments
                        const getRemoteAtts = await fetch(
                            `${directusUrl.replace(/\/+$/, "")}/items/company_memo_attachments?filter[company_memo_id][_eq]=${remoteMemo.id}&limit=-1`,
                            {
                                headers: {
                                    "Authorization": `Bearer ${directusToken}`
                                }
                            }
                        );
                        if (getRemoteAtts.ok) {
                            const atts = (await getRemoteAtts.json()).data as MemoRelationAttachment[];
                            await Promise.all(atts.map((att) => {
                                return fetch(`${directusUrl.replace(/\/+$/, "")}/items/company_memo_attachments/${att.id}`, {
                                    method: "DELETE",
                                    headers: {
                                        "Authorization": `Bearer ${directusToken}`
                                    }
                                });
                            }));
                        }

                        // Delete remote targeted company associations
                        const getRemotePerCos = await fetch(
                            `${directusUrl.replace(/\/+$/, "")}/items/company_memo_per_companies?filter[company_memo_id][_eq]=${remoteMemo.id}&limit=-1`,
                            {
                                headers: {
                                    "Authorization": `Bearer ${directusToken}`
                                }
                            }
                        );
                        if (getRemotePerCos.ok) {
                            const perCos = (await getRemotePerCos.json()).data as MemoRelationCompany[];
                            await Promise.all(perCos.map((pc) => {
                                return fetch(`${directusUrl.replace(/\/+$/, "")}/items/company_memo_per_companies/${pc.id}`, {
                                    method: "DELETE",
                                    headers: {
                                        "Authorization": `Bearer ${directusToken}`
                                    }
                                });
                            }));
                        }

                        // Delete remote memo row
                        const deleteRemoteRes = await fetch(
                            `${directusUrl.replace(/\/+$/, "")}/items/company_memo/${remoteMemo.id}`,
                            {
                                method: "DELETE",
                                headers: {
                                    "Authorization": `Bearer ${directusToken}`
                                }
                            }
                        );

                        if (!deleteRemoteRes.ok) {
                            failedCompanies.push(company.company_name);
                        }
                    }
                } else {
                    failedCompanies.push(company.company_name);
                }
            } catch (err) {
                console.error(`Failed to delete remote Directus for ${company.company_name}:`, err);
                failedCompanies.push(company.company_name);
            }
        }
    }

    // 2. Delete Locally
    try {
        // Drop local targeted company mappings first
        const getLocalPerCos = await fetch(
            `${UPSTREAM_BASE.replace(/\/+$/, "")}/items/company_memo_per_companies?filter[company_memo_id][_eq]=${memo.id}&limit=-1`,
            {
                headers: {
                    "Authorization": `Bearer ${process.env.DIRECTUS_STATIC_TOKEN}`
                }
            }
        );
        if (getLocalPerCos.ok) {
            const perCos = (await getLocalPerCos.json()).data as MemoRelationCompany[];
            await Promise.all(perCos.map((pc) => {
                return fetch(`${UPSTREAM_BASE.replace(/\/+$/, "")}/items/company_memo_per_companies/${pc.id}`, {
                    method: "DELETE",
                    headers: {
                        "Authorization": `Bearer ${process.env.DIRECTUS_STATIC_TOKEN}`
                    }
                });
            }));
        }

        // Delete local memo (attachments cascade automatically since constraint is set on DELETE CASCADE!)
        await fetch(`${UPSTREAM_BASE.replace(/\/+$/, "")}/items/company_memo/${memo.id}`, {
            method: "DELETE",
            headers: {
                "Authorization": `Bearer ${process.env.DIRECTUS_STATIC_TOKEN}`
            }
        });
    } catch (e) {
        console.error("Local delete failed", e);
    }

    return NextResponse.json({
        success: true,
        failedCompanies
    });
}

export async function GET(req: NextRequest) { return handleGet(req); }
export async function POST(req: NextRequest) { return handlePost(req); }
export async function PATCH(req: NextRequest) { return handlePatch(req); }
export async function DELETE(req: NextRequest) { return handleDelete(req); }
