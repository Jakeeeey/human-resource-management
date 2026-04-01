import { NextRequest, NextResponse } from "next/server";

// ============================================================================
// CONFIG
// ============================================================================

const DIRECTUS_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
if (!DIRECTUS_URL) {
    throw new Error("NEXT_PUBLIC_API_BASE_URL is not defined in environment variables");
}
const LIMIT = 1000;

const COLLECTIONS = {
    INDUSTRY: "industry",
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

// ============================================================================
// HELPERS
// ============================================================================

async function fetchAll<T>(collection: string, offset = 0, acc: T[] = []): Promise<T[]> {
    const url = `${DIRECTUS_URL}/items/${collection}?limit=${LIMIT}&offset=${offset}`;
    const res = await fetch(url, {
        cache: "no-store",
        headers: {
            "Authorization": `Bearer ${process.env.DIRECTUS_STATIC_TOKEN}`
        }
    });

    if (!res.ok) {
        const text = await res.text();
        console.error(`DIRECTUS ERROR [${url}]:`, text);
        throw new Error(`Directus error ${collection}: ${text}`);
    }

    const json = await res.json();
    const items = json.data || [];
    const all = [...acc, ...items];

    if (items.length === LIMIT) {
        return fetchAll(collection, offset + LIMIT, all);
    }

    return all;
}

// ============================================================================
// GET - List All Industries
// ============================================================================

export async function GET() {
    try {
        const industries = await fetchAll(COLLECTIONS.INDUSTRY);

        return NextResponse.json({
            industries,
            metadata: {
                total: industries.length,
                lastUpdated: new Date().toISOString(),
            },
        });
    } catch (e: unknown) {
        console.error("Industry API GET error:", e);
        return NextResponse.json(
            { error: e instanceof Error ? e.message : "Failed to fetch industries" },
            { status: 500 }
        );
    }
}

// ============================================================================
// POST - Create Industry
// ============================================================================

export async function POST(req: NextRequest) {
    if (!process.env.DIRECTUS_STATIC_TOKEN) {
        return NextResponse.json({ error: "Server Error: DIRECTUS_STATIC_TOKEN is missing" }, { status: 500 });
    }

    try {
        const body = await req.json();
        const { 
            industry_name, 
            industry_description, 
            industry_head, 
            industry_code, 
            tax_id 
        } = body;

        const newIndustryData = {
            industry_name,
            industry_description,
            industry_head,
            industry_code,
            tax_id: tax_id ? Number(tax_id) : null,
            date_added: new Date().toISOString().split('T')[0], // date format YYYY-MM-DD
        };

        const res = await fetch(
            `${DIRECTUS_URL}/items/${COLLECTIONS.INDUSTRY}`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${process.env.DIRECTUS_STATIC_TOKEN}`
                },
                body: JSON.stringify(newIndustryData),
            }
        );

        if (!res.ok) {
            const errorText = await res.text();
            console.error("POST industry error:", {
                status: res.status,
                statusText: res.statusText,
                body: errorText,
                payload: newIndustryData
            });
            throw new Error(`Directus industry create failed: ${res.statusText} - ${errorText}`);
        }

        const json = await res.json();
        return NextResponse.json({ industry: json.data });

    } catch (e) {
        console.error("Industry API POST error:", e);
        return NextResponse.json(
            {
                error: "Failed to create industry",
                message: e instanceof Error ? e.message : "Unknown error",
            },
            { status: 500 }
        );
    }
}

// ============================================================================
// PATCH - Update Industry
// ============================================================================

export async function PATCH(req: NextRequest) {
    if (!process.env.DIRECTUS_STATIC_TOKEN) {
        return NextResponse.json({ error: "Server Error: DIRECTUS_STATIC_TOKEN is missing" }, { status: 500 });
    }

    try {
        const body = await req.json();
        const { id, ...updateData } = body;

        if (!id) {
            return NextResponse.json(
                { error: "Industry ID is required" },
                { status: 400 }
            );
        }

        // Sanitization
        const cleanUpdateData = {
            ...updateData,
        };

        if (cleanUpdateData.tax_id) cleanUpdateData.tax_id = Number(cleanUpdateData.tax_id);

        const res = await fetch(
            `${DIRECTUS_URL}/items/${COLLECTIONS.INDUSTRY}/${id}`,
            {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${process.env.DIRECTUS_STATIC_TOKEN}`
                },
                body: JSON.stringify(cleanUpdateData),
            }
        );

        if (!res.ok) {
            const text = await res.text();
            console.error("Industry update failed", {
                status: res.status,
                statusText: res.statusText,
                body: text,
            });
            throw new Error(`Failed to update industry: ${res.statusText}`);
        }

        const json = await res.json();
        return NextResponse.json(json);
    } catch (e) {
        console.error("Industry API PATCH error:", e);
        return NextResponse.json(
            { error: "Failed to update industry", message: e instanceof Error ? e.message : "Unknown error" },
            { status: 500 }
        );
    }
}

