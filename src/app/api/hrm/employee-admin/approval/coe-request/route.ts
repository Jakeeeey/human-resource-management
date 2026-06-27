import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

const DIRECTUS_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
const COOKIE_NAME = "vos_access_token";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    if (!token) return null;
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

async function getAuthToken(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(COOKIE_NAME)?.value || null;
}

async function directusFetch(path: string, options: RequestInit = {}) {
  const token = process.env.DIRECTUS_STATIC_TOKEN || "";

  const response = await fetch(`${DIRECTUS_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Directus API error: ${response.status} - ${error}`);
  }

  return response.json();
}

export async function GET() {
  try {
    const token = await getAuthToken();
    const payload = token ? decodeJwtPayload(token) : null;

    if (!payload) {
      return NextResponse.json(
        { error: "Unauthorized: No valid token" },
        { status: 401 }
      );
    }

    const coeResponse = await directusFetch(
      `/items/coe_requests?sort=-request_date&limit=1000&fields=*`
    );

    const requests = coeResponse.data || [];

    const userIds = [...new Set(requests.map((r: { employee_id: number }) => r.employee_id))] as number[];
    const usersPromises = userIds.map((id) =>
      directusFetch(`/items/user/${id}?fields=user_id,user_fname,user_lname,user_mname`)
        .catch(() => null)
    );
    const usersData = await Promise.all(usersPromises);
    const usersMap = new Map(
      usersData
        .filter((u) => u?.data)
        .map((u) => [u.data.user_id, u.data])
    );

    const enrichedRequests = requests.map((req: { employee_id: number }) => {
      const user = usersMap.get(req.employee_id);

      return {
        ...req,
        user_fname: user?.user_fname || "Unknown",
        user_lname: user?.user_lname || "",
        user_mname: user?.user_mname || null,
      };
    });

    return NextResponse.json({
      data: enrichedRequests,
      total: enrichedRequests.length,
    });
  } catch (error) {
    console.error("GET coe_requests error:", error);
    return NextResponse.json(
      { error: "Failed to fetch COE requests" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const token = await getAuthToken();
    const payload = token ? decodeJwtPayload(token) : null;

    if (!payload) {
      return NextResponse.json(
        { error: "Unauthorized: No valid token" },
        { status: 401 }
      );
    }

    const userId = payload?.id || payload?.user_id || payload?.sub;
    const body = await req.json();
    const { coe_id, status, remarks } = body;

    if (!coe_id || !status || !["APPROVED", "REJECTED"].includes(status)) {
      return NextResponse.json(
        { error: "Invalid request: coe_id and status (APPROVED/REJECTED) are required" },
        { status: 400 }
      );
    }

    const updateData: Record<string, unknown> = {
      status,
      hr_remarks: remarks || null,
      approved_by: userId,
      approval_date: new Date().toISOString(),
    };

    await directusFetch(`/items/coe_requests/${coe_id}`, {
      method: "PATCH",
      body: JSON.stringify(updateData),
    });

    return NextResponse.json({
      success: true,
      message: `COE request ${status.toLowerCase()} successfully`,
    });
  } catch (error) {
    console.error("PATCH coe_request error:", error);
    return NextResponse.json(
      { error: "Failed to update COE request" },
      { status: 500 }
    );
  }
}
