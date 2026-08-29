import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const UPSTREAM_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

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
    released_at: string | null;
    released_by: number | null;
}

interface PerCompany {
    company_memo_id: number;
    company_id: number;
}

interface RemoteUser {
    user_id: number;
    user_fname?: string;
    user_lname?: string;
    user_email?: string;
}

interface RemoteAcknowledgement {
    id: number;
    acknowledged_at: string;
    user_id: number | RemoteUser | null;
}

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
    const action = searchParams.get("action");

    const headers = new Headers();
    const token = process.env.DIRECTUS_STATIC_TOKEN;
    if (token) headers.set("Authorization", `Bearer ${token}`);

    // Action 1: Fetch all Released Memos
    if (action !== "fetch_logs") {
        const memoNo = searchParams.get("memo_no");
        let upstreamUrl = `${UPSTREAM_BASE.replace(/\/+$/, "")}/items/company_memo?filter[status][_eq]=Released&filter[is_delete][_eq]=0&fields=*,created_by.*,released_by.*&sort=-released_at`;
        if (memoNo) {
            upstreamUrl += `&filter[memo_no][_contains]=${encodeURIComponent(memoNo)}`;
        }

        try {
            const [res, perRes] = await Promise.all([
                fetch(upstreamUrl, { headers }),
                fetch(`${UPSTREAM_BASE.replace(/\/+$/, "")}/items/company_memo_per_companies?limit=-1`, { headers })
            ]);

            if (!res.ok) {
                return NextResponse.json({ error: "Upstream Error" }, { status: res.status });
            }

            const [memoData, perData] = await Promise.all([
                res.json(),
                perRes.ok ? perRes.json() : { data: [] }
            ]);

            const perCompanies = (perData.data || []) as PerCompany[];
            const memos = (memoData.data || []).map((item: RawMemo) => {
                const rawPerCompanies = perCompanies.filter((c) => Number(c.company_memo_id) === Number(item.id));
                return {
                    ...item,
                    company_ids: rawPerCompanies.map((c) => Number(c.company_id))
                };
            });

            return NextResponse.json({ data: memos });
        } catch (e) {
            console.error("GET released memos failed:", e);
            return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
        }
    }

    // Action 2: Fetch Acknowledgements Logs for a specific memo_no
    const memoNo = searchParams.get("memo_no");
    if (!memoNo) {
        return NextResponse.json({ error: "Missing memo_no parameter" }, { status: 400 });
    }

    try {
        // Query main database record for this memo_no to find target company ids
        const mainMemoRes = await fetch(
            `${UPSTREAM_BASE.replace(/\/+$/, "")}/items/company_memo?filter[memo_no][_eq]=${memoNo}&limit=1`,
            { headers }
        );
        if (!mainMemoRes.ok) {
            return NextResponse.json({ error: "Failed to fetch local memo details" }, { status: 400 });
        }

        const { data: mainMemos } = await mainMemoRes.json();
        if (!mainMemos || mainMemos.length === 0) {
            return NextResponse.json({ error: "Local memo not found" }, { status: 404 });
        }
        const memo = mainMemos[0];

        // Fetch selected target companies mapping
        const perCompaniesRes = await fetch(
            `${UPSTREAM_BASE.replace(/\/+$/, "")}/items/company_memo_per_companies?filter[company_memo_id][_eq]=${memo.id}&limit=-1`,
            { headers }
        );
        const oldPerCompanies = perCompaniesRes.ok ? (await perCompaniesRes.json()).data || [] : [];
        const targetCompanyIds = (oldPerCompanies as PerCompany[]).map((c) => Number(c.company_id));

        if (targetCompanyIds.length === 0) {
            return NextResponse.json({ data: [] });
        }

        // Fetch full company records from the list to get Directus credentials
        const companiesList = await fetchCompaniesList();
        const targetCompanies = companiesList.filter(c => targetCompanyIds.includes(Number(c.company_id)));

        // Query each target company in parallel
        const results = await Promise.all(
            targetCompanies.map(async (company) => {
                const companyInfo = {
                    company_id: company.company_id,
                    company_name: company.company_name,
                    company_code: company.company_code
                };

                if (!company.directus || !company.directus_token) {
                    return {
                        ...companyInfo,
                        status: "offline",
                        error: "Directus credentials not configured"
                    };
                }

                try {
                    // 1. Fetch remote memo matching memo_no to get the remote memo id
                    const remoteMemoRes = await fetch(
                        `${company.directus.replace(/\/+$/, "")}/items/company_memo?filter[memo_no][_eq]=${memoNo}&limit=1`,
                        {
                            headers: { "Authorization": `Bearer ${company.directus_token}` },
                            signal: AbortSignal.timeout(10000) // 10s timeout
                        }
                    );

                    if (!remoteMemoRes.ok) {
                        return {
                            ...companyInfo,
                            status: "offline",
                            error: `HTTP Error ${remoteMemoRes.status} fetching remote memo`
                        };
                    }

                    const { data: remoteMemos } = await remoteMemoRes.json();
                    if (!remoteMemos || remoteMemos.length === 0) {
                        return {
                            ...companyInfo,
                            status: "success",
                            acknowledgements: [] // Not yet synced / created there
                        };
                    }
                    const remoteMemo = remoteMemos[0];

                    // 2. Fetch acknowledgements for this remote memo id
                    const ackRes = await fetch(
                        `${company.directus.replace(/\/+$/, "")}/items/company_memo_user_acknowledge?filter[company_memo_id][_eq]=${remoteMemo.id}&fields=*,user_id.*`,
                        {
                            headers: { "Authorization": `Bearer ${company.directus_token}` },
                            signal: AbortSignal.timeout(10000)
                        }
                    );

                    if (!ackRes.ok) {
                        return {
                            ...companyInfo,
                            status: "offline",
                            error: `HTTP Error ${ackRes.status} fetching acknowledgements`
                        };
                    }

                    const { data: acknowledgements } = await ackRes.json();
                    const logs = ((acknowledgements || []) as RemoteAcknowledgement[]).map((ack) => {
                        const userObj = ack.user_id;
                        return {
                            id: ack.id,
                            acknowledged_at: ack.acknowledged_at,
                            user_fname: typeof userObj === "object" && userObj !== null ? userObj.user_fname || "" : "",
                            user_lname: typeof userObj === "object" && userObj !== null ? userObj.user_lname || "" : "",
                            user_email: typeof userObj === "object" && userObj !== null ? userObj.user_email || "" : "",
                            user_id: typeof userObj === "object" && userObj !== null ? userObj.user_id : (userObj || 0)
                        };
                    });

                    return {
                        ...companyInfo,
                        status: "success",
                        acknowledgements: logs
                    };

                } catch (e) {
                    console.error(`Failed connection to ${company.company_name}:`, e);
                    return {
                        ...companyInfo,
                        status: "offline",
                        error: (e as Error).message || "Connection timeout / error"
                    };
                }
            })
        );

        return NextResponse.json({ data: results });

    } catch (e) {
        console.error("GET acknowledgements logs failed:", e);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
