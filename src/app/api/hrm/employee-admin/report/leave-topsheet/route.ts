import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

const DIRECTUS_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
const COOKIE_NAME = "vos_access_token";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// ============================================================================
// TYPES
// ============================================================================

interface JwtPayload {
  id?: number;
  user_id?: number;
  sub?: number;
  [key: string]: unknown;
}

interface LeaveRequest {
  leave_request_id: number;
  user_id: number;
  department_id?: number;
  status: string;
  filed_at?: string;
  leave_start: string;
  leave_end: string;
  total_days: string | number;
  [key: string]: unknown;
}

function decodeJwtPayload(token: string): JwtPayload | null {
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

export async function GET(req: NextRequest) {
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

    const url = new URL(req.url);
    const startDate = url.searchParams.get("startDate");
    const endDate = url.searchParams.get("endDate");
    const reqDepartmentId = url.searchParams.get("department_id");

    // Fetch current user details
    const userResponse = await directusFetch(
      `/items/user/${userId}?fields=*`
    );

    if (!userResponse.data) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const currentUser = userResponse.data;
    const userDepartment = currentUser.user_department;

    // Check if user is HR (department_id = 2) or an Admin
    const isHRAdmin = userDepartment === 2 || currentUser.isAdmin === 1 || currentUser.isAdmin === true;

    // If not HR or Admin, user can only see their own department's data
    let targetDepartmentId: number | null = null;
    
    if (isHRAdmin) {
      targetDepartmentId = reqDepartmentId && reqDepartmentId !== "all" ? parseInt(reqDepartmentId) : null;
    } else {
      targetDepartmentId = userDepartment;
    }

    // Build query for leave requests
    let leaveUrl = `/items/leave_request?limit=-1&sort=-filed_at&fields=*&filter[status][_eq]=approved`;

    if (targetDepartmentId) {
      leaveUrl += `&filter[department_id][_eq]=${targetDepartmentId}`;
    }

    if (startDate) {
      leaveUrl += `&filter[filed_at][_gte]=${startDate}`;
    }

    if (endDate) {
      leaveUrl += `&filter[filed_at][_lte]=${endDate}`;
    }

    const leaveResponse = await directusFetch(leaveUrl);
    const requests: LeaveRequest[] = leaveResponse.data || [];

    // Early exit if no requests
    if (requests.length === 0) {
      return NextResponse.json({
        data: [],
        total: 0,
      });
    }

    // Fetch required users and departments
    const userIds = [...new Set(requests.map(r => r.user_id))];
    const deptIds = [...new Set(requests.map(r => r.department_id).filter(Boolean))] as number[];

    const usersMap = new Map();
    const deptsMap = new Map();

    if (userIds.length > 0) {
      const userQuery = userIds.join(",");
      const allUsersRes = await directusFetch(`/items/user?limit=-1&fields=user_id,user_fname,user_mname,user_lname,user_department&filter[user_id][_in]=${userQuery}`);
      (allUsersRes.data || []).forEach((u: { user_id: number; [key: string]: unknown }) => usersMap.set(u.user_id, u));
    }

    if (deptIds.length > 0) {
      const deptQuery = deptIds.join(",");
      const allDeptsRes = await directusFetch(`/items/department?limit=-1&filter[department_id][_in]=${deptQuery}`);
      (allDeptsRes.data || []).forEach((d: { department_id: number; department_name: string }) => deptsMap.set(d.department_id, d.department_name));
    }

    interface GroupedUser {
      user_id: number;
      employee_name: string;
      department_name: string | null;
      total_leave_days: number;
      requests: Record<string, unknown>[];
    }
    const userGroups = new Map<number, GroupedUser>();

    for (const req of requests) {
      const user = usersMap.get(req.user_id);
      const fullName = user
        ? `${user.user_fname} ${user.user_mname ? user.user_mname + " " : ""}${user.user_lname}`
        : "Unknown";
      
      const deptName = req.department_id ? deptsMap.get(req.department_id) : "Unknown";

      const enrichedReq = {
        ...req,
        department_name: deptName,
        user_fname: user?.user_fname || "",
        user_mname: user?.user_mname || null,
        user_lname: user?.user_lname || "",
        employee_name: fullName,
      };

      if (!userGroups.has(req.user_id)) {
        userGroups.set(req.user_id, {
          user_id: req.user_id,
          employee_name: fullName,
          department_name: deptName,
          total_leave_days: 0,
          requests: [],
        });
      }

      const group = userGroups.get(req.user_id);
      if (group) {
        group.total_leave_days += parseFloat(req.total_days as string) || 0;
        group.requests.push(enrichedReq);
      }
    }

    const groupedData = Array.from(userGroups.values());
    
    // Sort groupedData alphabetically by employee name
    groupedData.sort((a, b) => a.employee_name.localeCompare(b.employee_name));

    // Also fetch all departments for the dropdown
    const allDeptsResponse = await directusFetch(`/items/department?limit=-1`);
    const allDepartments = allDeptsResponse.data || [];

    return NextResponse.json({
      data: groupedData,
      total: groupedData.length,
      departments: allDepartments,
      currentUser
    });
  } catch (error) {
    console.error("GET leave topsheet error:", error);
    return NextResponse.json(
      { error: "Failed to fetch leave topsheet data" },
      { status: 500 }
    );
  }
}
