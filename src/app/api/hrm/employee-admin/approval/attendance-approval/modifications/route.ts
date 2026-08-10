import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

function getAuthHeader(): Record<string, string> {
  if (process.env.DIRECTUS_STATIC_TOKEN) {
    return {
      Authorization: `Bearer ${process.env.DIRECTUS_STATIC_TOKEN}`,
    };
  }
  return {};
}

async function directusFetch(path: string, options: RequestInit = {}) {
  const url = `${API_BASE_URL}${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeader(),
      ...options.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`Directus API Error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "pending";
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "10", 10);
    const offset = (page - 1) * limit;

    // 1. Fetch Change Requests
    const response = await directusFetch(
      `/items/attendance_change_request?filter[status][_eq]=${status}&limit=${limit}&offset=${offset}&sort=-date_created&fields=*`
    );

    const changeRequests = response.data || [];

    if (changeRequests.length === 0) {
      return NextResponse.json({ data: [], total: 0 });
    }

    // 2. Fetch Users
    const userIds = [...new Set(changeRequests.map((r: { user_id: number }) => r.user_id))] as number[];
    let usersResponse = { data: [] };
    if (userIds.length > 0) {
      usersResponse = await directusFetch(
        `/items/user?filter[user_id][_in]=${userIds.join(",")}&fields=user_id,user_fname,user_lname,user_department`
      );
    }

    const usersMap = new Map();
    const deptIds = new Set<number>();
    
    (usersResponse.data || []).forEach((user: { user_id: number, user_department?: number, user_fname?: string, user_lname?: string }) => {
      usersMap.set(user.user_id, user);
      if (user.user_department) deptIds.add(user.user_department);
    });

    // Fetch Departments
    const deptsMap = new Map();
    if (deptIds.size > 0) {
      const deptsResponse = await directusFetch(
        `/items/department?filter[department_id][_in]=${Array.from(deptIds).join(",")}&fields=department_id,department_name`
      );
      (deptsResponse.data || []).forEach((d: { department_id: number, department_name: string }) => {
        deptsMap.set(d.department_id, d.department_name);
      });
    }

    // 3. Fetch junction files
    const requestIds = changeRequests.map((r: { id: number }) => r.id).join(",");
    let junctionData: { attendance_change_request_id: number, directus_files_id: any }[] = [];
    if (requestIds) {
      try {
        const junctionResponse = await directusFetch(
          `/items/attendance_change_request_files?filter[attendance_change_request_id][_in]=${requestIds}&fields=*,directus_files_id.id,directus_files_id.filename_download`
        );
        junctionData = junctionResponse.data || [];
      } catch (err) {
        console.error("Error fetching junction files:", err);
      }
    }

    // Combine data
    const enrichedRequests = changeRequests.map((req: { id: number, user_id: number, [key: string]: unknown }) => {
      const user = usersMap.get(req.user_id);
      const department_name = user?.user_department ? deptsMap.get(user.user_department) : null;
      
      const files = junctionData.filter(
        (j) => String(j.attendance_change_request_id) === String(req.id)
      );

      return {
        ...req,
        user_fname: user?.user_fname || "Unknown",
        user_lname: user?.user_lname || "",
        department_name,
        attendance_change_request_files: files,
      };
    });

    // Get total count
    const countResponse = await directusFetch(
      `/items/attendance_change_request?filter[status][_eq]=${status}&aggregate[count]=*`
    );
    const total = countResponse.data?.[0]?.count || 0;

    return NextResponse.json({
      data: enrichedRequests,
      total: Number(total),
    });

  } catch (error: unknown) {
    console.error("Error fetching attendance change requests:", error);
    return NextResponse.json(
      { error: "Failed to fetch modifications" },
      { status: 500 }
    );
  }
}
