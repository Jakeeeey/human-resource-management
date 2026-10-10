import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

const DIRECTUS_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
const COOKIE_NAME = "vos_access_token";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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
    throw new Error(`Directus API error (${response.status}): ${error}`);
  }

  return response.json();
}

// ============================================================================
// GET: Fetch Employee Service Record or Employee List
// ============================================================================
export async function GET(req: NextRequest) {
  try {
    const token = await getAuthToken();
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const action = searchParams.get("action");
    const userIdParam = searchParams.get("userId");

    // Action 1: Search / List Employees for Selector
    if (action === "employees") {
      const search = searchParams.get("search")?.trim().toLowerCase() || "";
      const filter = "filter[isDeleted][_neq]=1&sort=user_lname,user_fname&limit=500";
      const usersRes = await directusFetch(
        `/items/user?${filter}&fields=user_id,user_fname,user_mname,user_lname,user_position,user_department,user_dateOfHire`
      ).catch(() => ({ data: [] }));

      const deptsRes = await directusFetch(
        `/items/department?limit=500&fields=department_id,department_name`
      ).catch(() => ({ data: [] }));

      const deptsMap = new Map<number, string>(
        (deptsRes.data || []).map((d: { department_id: number; department_name: string }) => [
          d.department_id,
          d.department_name,
        ])
      );

      const allUsers = usersRes.data || [];
      const filtered = allUsers
        .filter((u: { user_fname?: string; user_lname?: string; user_id?: number }) => {
          if (!search) return true;
          const fullName = `${u.user_fname || ""} ${u.user_lname || ""}`.toLowerCase();
          return fullName.includes(search) || String(u.user_id).includes(search);
        })
        .map((u: { user_id: number; user_fname: string; user_mname?: string; user_lname: string; user_position?: string; user_department?: number; user_dateOfHire?: string }) => ({
          user_id: u.user_id,
          user_fname: u.user_fname,
          user_mname: u.user_mname || null,
          user_lname: u.user_lname,
          user_position: u.user_position || null,
          department_name: u.user_department ? deptsMap.get(u.user_department) || null : null,
          user_dateOfHire: u.user_dateOfHire || null,
        }));

      return NextResponse.json({ data: filtered });
    }

    // Action 2: Get Single Employee Service Record Profile
    if (!userIdParam) {
      return NextResponse.json({ error: "userId parameter is required" }, { status: 400 });
    }

    const userId = parseInt(userIdParam, 10);
    if (isNaN(userId)) {
      return NextResponse.json({ error: "Invalid userId" }, { status: 400 });
    }

    // 1. Fetch user data
    const userRes = await directusFetch(
      `/items/user/${userId}?fields=user_id,user_fname,user_mname,user_lname,user_maiden_name,user_bday,user_birth_place,user_bp_number,user_position,user_department,user_dateOfHire,separation_date,separation_cause,isDeleted`
    ).catch(() => ({ data: null }));

    if (!userRes.data) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }

    const user = userRes.data;

    // Fetch department name
    let departmentName: string | null = null;
    if (user.user_department) {
      const deptRes = await directusFetch(
        `/items/department/${user.user_department}?fields=department_name`
      ).catch(() => ({ data: null }));
      departmentName = deptRes.data?.department_name || null;
    }

    // 2. Fetch service records for this user
    const recordsRes = await directusFetch(
      `/items/employee_service_record?filter[user_id][_eq]=${userId}&sort=service_from,sequence_order&limit=500`
    ).catch(() => ({ data: [] }));

    const rawRecords = recordsRes.data || [];

    // 3. Fetch default settings / signatories
    const settingsRes = await directusFetch(
      `/items/service_record_setting?limit=1`
    ).catch(() => ({ data: [] }));

    const setting = settingsRes.data?.[0] || {
      id: 1,
      agency_name: "Republic of the Philippines",
      sub_header: "Department of Education",
      office_address: "",
      certification_text:
        "This is to certify that the employee named herein above actually rendered service in this Office as shown by the service record below. Each line of which is supported by appointment and other papers actually issued by this office and approved by the authorities concerned.",
      legal_basis_text:
        "Issued in compliance with Executive Order No. 54, dated August 10, 1954 in accordance with Circular No. 54, dated August 10, 1954 of the System.",
      default_prepared_by_name: "MELISSA O. SESIO",
      default_prepared_by_title: "Admin. Officer II",
      default_certified_by_name: "JOHN D. ALIDON",
      default_certified_by_title: "Admin. Officer IV/HRMO II",
    };

    // 4. Compute active / "Still in the Service" status
    const isSeparated = Boolean(user.separation_date && String(user.separation_date).trim() !== "");
    const isStillInService = !isSeparated && !user.isDeleted;

    return NextResponse.json({
      data: {
        employee: {
          user_id: user.user_id,
          user_fname: user.user_fname,
          user_mname: user.user_mname || null,
          user_lname: user.user_lname,
          user_maiden_name: user.user_maiden_name || null,
          user_bday: user.user_bday || null,
          user_birth_place: user.user_birth_place || null,
          user_bp_number: user.user_bp_number || null,
          user_position: user.user_position || null,
          user_department: user.user_department || null,
          department_name: departmentName,
          user_dateOfHire: user.user_dateOfHire || null,
          separation_date: user.separation_date || null,
          separation_cause: user.separation_cause || null,
          is_active: isStillInService,
        },
        records: rawRecords,
        setting,
        is_still_in_service: isStillInService,
      },
    });
  } catch (error) {
    console.error("GET /api/hrm/employee-admin/service-record error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal Server Error" },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST: Create Service Record Entry OR Update Employee Header
// ============================================================================
export async function POST(req: NextRequest) {
  try {
    const token = await getAuthToken();
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();

    // Mode A: Update Employee Header Info
    if (body.action === "update_employee_header") {
      const {
        user_id,
        user_maiden_name,
        user_bday,
        user_birth_place,
        user_bp_number,
        separation_date,
        separation_cause,
      } = body;

      if (!user_id) {
        return NextResponse.json({ error: "user_id is required" }, { status: 400 });
      }

      await directusFetch(`/items/user/${user_id}`, {
        method: "PATCH",
        body: JSON.stringify({
          user_maiden_name: user_maiden_name ?? null,
          user_bday: user_bday || null,
          user_birth_place: user_birth_place ?? null,
          user_bp_number: user_bp_number ?? null,
          separation_date: separation_date || null,
          separation_cause: separation_cause ?? null,
        }),
      });

      return NextResponse.json({ success: true, message: "Employee profile updated successfully" });
    }

    // Mode B: Create Service Record Entry
    const {
      user_id,
      service_from,
      service_to,
      designation,
      appointment_status,
      salary,
      salary_basis,
      station_assignment,
      branch,
      leave_wo_pay,
      cause,
      remarks,
      sequence_order,
    } = body;

    if (!user_id || !service_from || !designation) {
      return NextResponse.json(
        { error: "user_id, service_from, and designation are required" },
        { status: 400 }
      );
    }

    const newRecord = await directusFetch(`/items/employee_service_record`, {
      method: "POST",
      body: JSON.stringify({
        user_id,
        service_from,
        service_to: service_to || null,
        designation,
        appointment_status: appointment_status || "Reg.Perm.",
        salary: Number(salary || 0),
        salary_basis: salary_basis || "Per Annum",
        station_assignment: station_assignment || "",
        branch: branch || "National",
        leave_wo_pay: leave_wo_pay || "None",
        cause: cause || "Orig. Appt.",
        remarks: remarks || null,
        sequence_order: Number(sequence_order || 1),
      }),
    });

    return NextResponse.json({
      success: true,
      data: newRecord.data,
      message: "Service record entry created successfully",
    });
  } catch (error) {
    console.error("POST /api/hrm/employee-admin/service-record error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal Server Error" },
      { status: 500 }
    );
  }
}
