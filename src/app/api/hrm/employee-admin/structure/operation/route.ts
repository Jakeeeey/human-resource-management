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
    OPERATION: "operation",
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
// GET - List All Operations
// ============================================================================

export async function GET() {
    try {
        const operations = await fetchAll(COLLECTIONS.OPERATION);

        return NextResponse.json({
            operations,
            metadata: {
                total: operations.length,
                lastUpdated: new Date().toISOString(),
            },
        });
    } catch (e: unknown) {
        console.error("Operation API GET error:", e);
        return NextResponse.json(
            { error: e instanceof Error ? e.message : "Failed to fetch operations" },
            { status: 500 }
        );
    }
}

// ============================================================================
// POST - Create Operation
// ============================================================================

export async function POST(req: NextRequest) {
    if (!process.env.DIRECTUS_STATIC_TOKEN) {
        return NextResponse.json({ error: "Server Error: DIRECTUS_STATIC_TOKEN is missing" }, { status: 500 });
    }

    try {
        const body = await req.json();
        const { operation_code, operation_name, type, definition, company_id, encoder_id } = body;

        const newOperationData = {
            operation_code,
            operation_name,
            type: type ? Number(type) : null,
            definition,
            company_id: company_id ? Number(company_id) : null,
            encoder_id: encoder_id ? Number(encoder_id) : null,
            created_at: new Date().toISOString(),
        };

        const res = await fetch(
            `${DIRECTUS_URL}/items/${COLLECTIONS.OPERATION}`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${process.env.DIRECTUS_STATIC_TOKEN}`
                },
                body: JSON.stringify(newOperationData),
            }
        );

        if (!res.ok) {
            const errorText = await res.text();
            console.error("POST operation error:", {
                status: res.status,
                statusText: res.statusText,
                body: errorText,
                payload: newOperationData
            });
            throw new Error(`Directus operation create failed: ${res.statusText} - ${errorText}`);
        }

        const json = await res.json();
        return NextResponse.json({ operation: json.data });

    } catch (e) {
        console.error("Operation API POST error:", e);
        return NextResponse.json(
            {
                error: "Failed to create operation",
                message: e instanceof Error ? e.message : "Unknown error",
            },
            { status: 500 }
        );
    }
}

// ============================================================================
// PATCH - Update Operation
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
                { error: "Operation ID is required" },
                { status: 400 }
            );
        }

        // Sanitization and add date_modified
        const cleanUpdateData = {
            ...updateData,
            date_modified: new Date().toISOString(),
        };

        if (cleanUpdateData.type) cleanUpdateData.type = Number(cleanUpdateData.type);
        if (cleanUpdateData.company_id) cleanUpdateData.company_id = Number(cleanUpdateData.company_id);
        if (cleanUpdateData.encoder_id) cleanUpdateData.encoder_id = Number(cleanUpdateData.encoder_id);

        const res = await fetch(
            `${DIRECTUS_URL}/items/${COLLECTIONS.OPERATION}/${id}`,
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
            console.error("Operation update failed", {
                status: res.status,
                statusText: res.statusText,
                body: text,
            });
            throw new Error(`Failed to update operation: ${res.statusText}`);
        }

        const json = await res.json();
        return NextResponse.json(json);
    } catch (e) {
        console.error("Operation API PATCH error:", e);
        return NextResponse.json(
            { error: "Failed to update operation", message: e instanceof Error ? e.message : "Unknown error" },
            { status: 500 }
        );
    }
}

// ============================================================================
// DELETE - Delete Operation
// ============================================================================

export async function DELETE(req: NextRequest) {
    if (!process.env.DIRECTUS_STATIC_TOKEN) {
        return NextResponse.json({ error: "Server Error: DIRECTUS_STATIC_TOKEN is missing" }, { status: 500 });
    }
    try {
        const id = req.nextUrl.searchParams.get("id");

        if (!id) {
            return NextResponse.json(
                { error: "Operation ID is required" },
                { status: 400 }
            );
        }

        const res = await fetch(
            `${DIRECTUS_URL}/items/${COLLECTIONS.OPERATION}/${id}`,
            {
                method: "DELETE",
                headers: {
                    "Authorization": `Bearer ${process.env.DIRECTUS_STATIC_TOKEN}`
                }
            }
        );

        if (!res.ok) {
            throw new Error(`Failed to delete operation: ${res.statusText}`);
        }

        return NextResponse.json({ success: true });
    } catch (e) {
        console.error("Operation API DELETE error:", e);
        return NextResponse.json(
            { error: "Failed to delete operation", message: e instanceof Error ? e.message : "Unknown error" },
            { status: 500 }
        );
    }
}
