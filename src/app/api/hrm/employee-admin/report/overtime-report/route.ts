import { NextResponse } from "next/server";
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

interface OvertimeRequest {
  overtime_id: number;
  user_id: number;
  department_id?: number;
  status: string;
  filed_at?: string;
  [key: string]: unknown;
}

interface Department {
  department_id: number;
  department_name: string;
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

    // Fetch current user details
    const userResponse = await directusFetch(
      `/items/user/${userId}?fields=*`
    );

    if (!userResponse.data) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const currentUser = userResponse.data;
    const userDepartment = currentUser.user_department;

    // Fetch all departments
    const deptResponse = await directusFetch(`/items/department?limit=1000`);
    const departments = deptResponse.data || [];

    // Fetch overtime requests based on department
    // If user is from HR (department_id = 2), fetch all requests
    // Otherwise, fetch only their department's requests
    let overtimeUrl = `/items/overtime_request?limit=1000&sort=-filed_at&fields=*`;

    if (userDepartment !== 2) {
      overtimeUrl += `&filter[department_id][_eq]=${userDepartment}`;
    }

    const overtimeResponse = await directusFetch(overtimeUrl);
    const requests = overtimeResponse.data || [];

    // Fetch all unique users
    const userIds = [...new Set(requests.map((r: OvertimeRequest) => r.user_id))].filter(
      (id): id is number => typeof id === "number"
    );
    const usersMap = new Map();

    await Promise.all(
      userIds.map(async (id: number) => {
        try {
          const userRes = await directusFetch(`/items/user/${id}?fields=*`);
          if (userRes.data) {
            usersMap.set(id, userRes.data);
          }
        } catch (err) {
          console.error(`Failed to fetch user ${id}:`, err);
        }
      })
    );

    // Enrich overtime requests with user details
    const enrichedRequests = requests.map((req: OvertimeRequest) => {
      const user = usersMap.get(req.user_id);
      const department = departments.find(
        (d: Department) => d.department_id === req.department_id
      );

      const fullName = user
        ? `${user.user_fname} ${user.user_mname ? user.user_mname + " " : ""}${user.user_lname}`
        : "Unknown";

      return {
        ...req,
        user,
        department,
        employee_name: fullName,
      };
    });

    return NextResponse.json({
      currentUser,
      departments,
      overtimeRequests: enrichedRequests,
    });
  } catch (error) {
    console.error("GET overtime report error:", error);
    return NextResponse.json(
      { error: "Failed to fetch overtime report data" },
      { status: 500 }
    );
  }
}
