import { NextRequest, NextResponse } from "next/server";

const DIRECTUS_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
const DIRECTUS_TOKEN =
  process.env.DIRECTUS_STATIC_TOKEN ||
  process.env.DIRECTUS_TOKEN ||
  process.env.NEXT_PUBLIC_DIRECTUS_STATIC_TOKEN;

if (!DIRECTUS_URL) {
  throw new Error("NEXT_PUBLIC_API_BASE_URL is not defined in environment variables");
}

export const dynamic = "force-dynamic";
export const revalidate = 0;

const LIMIT = 1000;

async function dFetch(path: string, options: RequestInit = {}) {
  const url = `${DIRECTUS_URL}${path}`;

  const res = await fetch(url, {
    ...options,
    cache: "no-store",
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(DIRECTUS_TOKEN ? { Authorization: `Bearer ${DIRECTUS_TOKEN}` } : {}),
      ...(options.headers || {}),
    },
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`DIRECTUS ERROR [${options.method || "GET"} ${url}]:`, text);
    return NextResponse.json(
      {
        error: "Directus request failed",
        status: res.status,
        details: text,
      },
      { status: res.status }
    );
  }

  if (res.status === 204) return null;
  return res.json();
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const salesmanId = searchParams.get("salesmanId");

  if (!salesmanId) {
    return NextResponse.json({ error: "salesmanId is required" }, { status: 400 });
  }

  try {
    const [customersJson, assignedJson] = await Promise.all([
      dFetch(`/items/customer?limit=${LIMIT}`),
      dFetch(
        `/items/customer_salesmen?filter[salesman_id][_eq]=${encodeURIComponent(
          salesmanId
        )}&limit=${LIMIT}`
      ),
    ]);

    if (customersJson instanceof NextResponse) return customersJson;
    if (assignedJson instanceof NextResponse) return assignedJson;

    const customers = customersJson?.data || [];
    const assigned = assignedJson?.data || [];

    return NextResponse.json({
      customers,
      assignedCustomerIds: assigned.map((a: { customer_id: number }) => a.customer_id),
    });
  } catch (error) {
    console.error("Error fetching customers:", error);
    return NextResponse.json(
      { error: "Failed to fetch customers" },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const salesmanId = body?.salesmanId;
    const customerIds: number[] = Array.isArray(body?.customerIds)
      ? body.customerIds
      : [];

    if (!salesmanId) {
      return NextResponse.json({ error: "salesmanId is required" }, { status: 400 });
    }

    // Fetch existing assignments
    const existingJson = await dFetch(
      `/items/customer_salesmen?filter[salesman_id][_eq]=${encodeURIComponent(
        String(salesmanId)
      )}&limit=${LIMIT}`
    );

    if (existingJson instanceof NextResponse) return existingJson;

    const existing = existingJson?.data || [];

    // Delete existing assignments
    for (const assignment of existing) {
      const delRes = await dFetch(`/items/customer_salesmen/${assignment.id}`, {
        method: "DELETE",
      });
      if (delRes instanceof NextResponse) return delRes;
    }

    // Create new assignments
    for (const customerId of customerIds) {
      const postRes = await dFetch(`/items/customer_salesmen`, {
        method: "POST",
        body: JSON.stringify({
          salesman_id: salesmanId,
          customer_id: customerId,
        }),
      });
      if (postRes instanceof NextResponse) return postRes;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error saving customer assignments:", error);
    return NextResponse.json(
      { error: "Failed to save customer assignments" },
      { status: 500 }
    );
  }
}
