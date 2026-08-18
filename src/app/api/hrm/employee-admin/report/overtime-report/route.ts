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

    // ── Parse query params ──────────────────────────────────────────────────
    const { searchParams } = new URL(req.url);
    const page       = Math.max(1, parseInt(searchParams.get("page")     || "1", 10));
    const pageSize   = Math.max(1, parseInt(searchParams.get("pageSize") || "10", 10));
    const search     = searchParams.get("search")     || "";
    const dateFrom   = searchParams.get("dateFrom")   || "";
    const dateTo     = searchParams.get("dateTo")     || "";
    const deptId     = searchParams.get("departmentId") || "";
    const nameFilter = searchParams.get("nameFilter") || "";
    const statusFilter = searchParams.get("statusFilter") || "";

    // ── Fetch current user ───────────────────────────────────────────────────
    const userResponse = await directusFetch(`/items/user/${userId}?fields=*`);
    if (!userResponse.data) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const currentUser   = userResponse.data;
    const userDepartment = currentUser.user_department;
    const isHRAdmin     = userDepartment === 2 || currentUser.isAdmin === 1 || currentUser.isAdmin === true;

    // ── Fetch all departments (small list, no pagination needed) ─────────────
    const deptResponse = await directusFetch(`/items/department?limit=-1&fields=department_id,department_name`);
    const departments  = deptResponse.data || [];

    // ── Fetch all users for name dropdown (small, once) ──────────────────────
    let userUrl = `/items/user?limit=-1&fields=user_id,user_fname,user_mname,user_lname,user_department,isAdmin`;
    if (!isHRAdmin) {
      userUrl += `&filter[user_department][_eq]=${userDepartment}`;
    }
    const allUsersRes = await directusFetch(userUrl);
    const allUsers    = allUsersRes.data || [];

    // ── Build Directus filter for overtime_request ───────────────────────────
    const filterParts: string[] = [];

    // Scope by department if not HR/Admin
    if (!isHRAdmin) {
      filterParts.push(`filter[department_id][_eq]=${userDepartment}`);
    } else if (deptId) {
      filterParts.push(`filter[department_id][_eq]=${deptId}`);
    }

    if (statusFilter) {
      filterParts.push(`filter[status][_eq]=${encodeURIComponent(statusFilter)}`);
    }

    if (dateFrom) {
      filterParts.push(`filter[request_date][_gte]=${encodeURIComponent(dateFrom)}`);
    }
    if (dateTo) {
      filterParts.push(`filter[request_date][_lte]=${encodeURIComponent(dateTo)}`);
    }

    // Name search: resolve to user_id first
    let nameUserIds: number[] = [];
    if (nameFilter || search) {
      const searchTerm = nameFilter || search;
      nameUserIds = allUsers
        .filter((u: { user_fname: string; user_mname?: string | null; user_lname: string; user_id: number }) => {
          const fullName = `${u.user_fname} ${u.user_mname ? u.user_mname + " " : ""}${u.user_lname}`.toLowerCase();
          return fullName.includes(searchTerm.toLowerCase());
        })
        .map((u: { user_id: number }) => u.user_id);

      if (nameUserIds.length === 0) {
        // No matching users → return empty result immediately
        return NextResponse.json({
          currentUser,
          departments,
          overtimeRequests: [],
          users: allUsers,
          pagination: { currentPage: page, pageSize, totalItems: 0, totalPages: 0 },
        });
      }

      nameUserIds.forEach((id, i) => {
        filterParts.push(`filter[user_id][_in][${i}]=${id}`);
      });
    }

    const filterQuery = filterParts.length > 0 ? `&${filterParts.join("&")}` : "";
    const overtimeUrl = `/items/overtime_request?limit=${pageSize}&page=${page}&sort=-filed_at&fields=*&meta=filter_count${filterQuery}`;

    const overtimeResponse = await directusFetch(overtimeUrl);
    const requests   = overtimeResponse.data || [];
    const totalCount = overtimeResponse.meta?.filter_count ?? requests.length;
    const totalPages = Math.ceil(totalCount / pageSize);

    // ── Build users map for enrichment ───────────────────────────────────────
    const usersMap = new Map<number, typeof allUsers[0]>();
    allUsers.forEach((user: { user_id?: number; id?: number; [key: string]: unknown }) => {
      const id = user.user_id || (user as { id?: number }).id;
      if (id) usersMap.set(id as number, user);
    });

    // ── Enrich requests ──────────────────────────────────────────────────────
    const enrichedRequests = requests.map((req: OvertimeRequest) => {
      const user = usersMap.get(req.user_id);
      const department = departments.find(
        (d: Department) => d.department_id === req.department_id
      );
      const fullName = user
        ? `${(user as {user_fname:string;user_mname?:string|null;user_lname:string}).user_fname} ${(user as {user_fname:string;user_mname?:string|null;user_lname:string}).user_mname ? (user as {user_fname:string;user_mname?:string|null;user_lname:string}).user_mname + " " : ""}${(user as {user_fname:string;user_mname?:string|null;user_lname:string}).user_lname}`
        : "Unknown";
      return { ...req, user, department, employee_name: fullName };
    });

    return NextResponse.json({
      currentUser,
      departments,
      overtimeRequests: enrichedRequests,
      users: allUsers,
      pagination: {
        currentPage: page,
        pageSize,
        totalItems: totalCount,
        totalPages: totalPages || 1,
      },
    });
  } catch (error) {
    console.error("GET overtime report error:", error);
    return NextResponse.json(
      { error: "Failed to fetch overtime report data" },
      { status: 500 }
    );
  }
}
