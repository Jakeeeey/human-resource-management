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
// GET - Fetch Leave Requests (Pending, filtered by department)
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

    // Fetch user details to get department (and role)
    const userResponse = await directusFetch(
      `/items/user/${userId}?fields=user_id,user_department,isAdmin,role.name`
    );

    const isAdmin = userResponse.data?.isAdmin === true || userResponse.data?.role?.name === 'Administrator';

    // Fetch TA Approver mappings for this user
    const taApproversResponse = await directusFetch(
      `/items/ta_draft_approvers?filter[approver_id][_eq]=${userId}&filter[is_deleted][_eq]=0`
    );
    
    const approvedDepartments: number[] = taApproversResponse.data?.map((a: { department_id: number }) => a.department_id) || [];
    const skipFilter = isAdmin && approvedDepartments.length === 0;

    if (!skipFilter && approvedDepartments.length === 0) {
      return NextResponse.json({
        data: [],
        total: 0,
        message: "You are not an assigned approver for any department."
      });
    }

    // Fetch ALL pending leave requests
    const filter = `filter[status][_eq]=pending`;
    const leaveResponse = await directusFetch(
      `/items/leave_request?${filter}&sort=-filed_at&limit=1000&fields=*`
    );

    let requests = leaveResponse.data || [];

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

    // Filter requests in JS based on the actual user's department
    if (!skipFilter) {
      requests = requests.filter((req: { user_id: number }) => {
        const user = usersMap.get(req.user_id);
        if (!user) return false;
        return approvedDepartments.includes(user.user_department);
      });
    }

    // Fetch department details for the filtered requests
    const deptIdsToFetch = new Set<number>();
    requests.forEach((req: { user_id: number; department_id?: number }) => {
      const user = usersMap.get(req.user_id);
      if (req.department_id) deptIdsToFetch.add(req.department_id);
      if (user?.user_department) deptIdsToFetch.add(user.user_department);
    });

    const deptIds = Array.from(deptIdsToFetch);
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
      const actualDeptId = req.department_id || user?.user_department;
      const dept = actualDeptId ? deptsMap.get(actualDeptId) : null;

      return {
        ...req,
        user_fname: user?.user_fname || "Unknown",
        user_lname: user?.user_lname || "",
        user_mname: user?.user_mname || null,
        department_name: dept?.department_name || null,
        department_id: actualDeptId
      };
    });

    return NextResponse.json({
      data: enrichedRequests,
      total: enrichedRequests.length,
    });
  } catch (error) {
    console.error("GET leave_request error:", error);
    return NextResponse.json(
      { error: "Failed to fetch leave requests" },
      { status: 500 }
    );
  }
}

// ============================================================================
// PATCH - Approve or Reject Leave Request
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
    const { leave_id, status, remarks } = body;

    if (!leave_id || !status || !['approved', 'rejected'].includes(status)) {
      return NextResponse.json(
        { error: "Invalid request: leave_id and status (approved/rejected) are required" },
        { status: 400 }
      );
    }

    // Update the leave request
    const updateData: Record<string, unknown> = {
      status,
      remarks: remarks || null,
      approver_id: userId,
      approved_at: new Date().toISOString(),
    };

    await directusFetch(`/items/leave_request/${leave_id}`, {
      method: "PATCH",
      body: JSON.stringify(updateData),
    });

    return NextResponse.json({
      success: true,
      message: `Leave request ${status} successfully`,
    });
  } catch (error) {
    console.error("PATCH leave_request error:", error);
    return NextResponse.json(
      { error: "Failed to update leave request" },
      { status: 500 }
    );
  }
}
