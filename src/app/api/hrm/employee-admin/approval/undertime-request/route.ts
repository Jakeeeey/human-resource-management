import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

const DIRECTUS_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
const COOKIE_NAME = "vos_access_token";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

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

// ============================================================================
// GET - Fetch Undertime Requests (Pending, filtered by department)
// ============================================================================

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

    const userId = payload?.id || payload?.user_id || payload?.sub;

    // Fetch user details to get department
    const userResponse = await directusFetch(
      `/items/user/${userId}?fields=user_id,user_department,isAdmin,role`
    );

    const currentUserDepartment = userResponse.data?.user_department;

    // Build query - only show pending requests from the user's department
    let filter = `filter[status][_eq]=pending`;

    // If user has a department, filter by that department
    if (currentUserDepartment) {
      filter += `&filter[department_id][_eq]=${currentUserDepartment}`;
    }

    // Fetch undertime requests with user details
    const undertimeResponse = await directusFetch(
      `/items/undertime_request?${filter}&sort=-filed_at&limit=1000&fields=*`
    );

    const requests = undertimeResponse.data || [];

    // Fetch user details for each request
    const userIds = [...new Set(requests.map((r: { user_id: number }) => r.user_id))] as number[];
    const usersPromises = userIds.map((id) =>
      directusFetch(`/items/user/${id}?fields=user_id,user_fname,user_lname,user_mname,user_department`)
        .catch(() => null)
    );
    const usersData = await Promise.all(usersPromises);
    const usersMap = new Map(
      usersData
        .filter((u) => u?.data)
        .map((u) => [u.data.user_id, u.data])
    );

    // Fetch department details
    const deptIds = [...new Set(requests.map((r: { department_id?: number }) => r.department_id).filter(Boolean))] as number[];
    const deptsPromises = deptIds.map((id) =>
      directusFetch(`/items/department/${id}?fields=department_id,department_name`)
        .catch(() => null)
    );
    const deptsData = await Promise.all(deptsPromises);
    const deptsMap = new Map(
      deptsData
        .filter((d) => d?.data)
        .map((d) => [d.data.department_id, d.data])
    );

    // Combine data
    const enrichedRequests = requests.map((req: { user_id: number; department_id?: number; [key: string]: unknown }) => {
      const user = usersMap.get(req.user_id);
      const dept = req.department_id ? deptsMap.get(req.department_id) : null;

      return {
        ...req,
        user_fname: user?.user_fname || "Unknown",
        user_lname: user?.user_lname || "",
        user_mname: user?.user_mname || null,
        department_name: dept?.department_name || null,
      };
    });

    return NextResponse.json({
      data: enrichedRequests,
      total: enrichedRequests.length,
    });
  } catch (error) {
    console.error("GET undertime_request error:", error);
    return NextResponse.json(
      { error: "Failed to fetch undertime requests" },
      { status: 500 }
    );
  }
}

// ============================================================================
// PATCH - Approve or Reject Undertime Request
// ============================================================================

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
    const { undertime_id, status, remarks } = body;

    if (!undertime_id || !status || !['approved', 'rejected'].includes(status)) {
      return NextResponse.json(
        { error: "Invalid request: undertime_id and status (approved/rejected) are required" },
        { status: 400 }
      );
    }

    // Update the undertime request
    const updateData: Record<string, unknown> = {
      status,
      remarks: remarks || null,
      approver_id: userId,
      approved_at: new Date().toISOString(),
    };

    await directusFetch(`/items/undertime_request/${undertime_id}`, {
      method: "PATCH",
      body: JSON.stringify(updateData),
    });

    return NextResponse.json({
      success: true,
      message: `Undertime request ${status} successfully`,
    });
  } catch (error) {
    console.error("PATCH undertime_request error:", error);
    return NextResponse.json(
      { error: "Failed to update undertime request" },
      { status: 500 }
    );
  }
}
