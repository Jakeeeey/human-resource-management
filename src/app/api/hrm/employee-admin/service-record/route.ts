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

const SPRING_BASE = process.env.SPRING_API_BASE_URL;

function isActiveUser(emp: Record<string, unknown>): boolean {
  const val = emp.isDeleted ?? emp.is_deleted ?? emp.deleted;
  if (val === undefined || val === null) return true;
  if (
    typeof val === "object" &&
    val !== null &&
    "data" in val &&
    Array.isArray((val as { data: unknown[] }).data)
  ) {
    return (val as { data: number[] }).data[0] === 0;
  }
  if (typeof val === "string") {
    const s = val.toLowerCase();
    return s !== "1" && s !== "true";
  }
  return !val;
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

      // 1. Fetch departments for lookup map
      const deptsRes = await directusFetch(
        `/items/department?limit=-1&fields=department_id,department_name`
      ).catch(() => ({ data: [] }));

      const deptsMap = new Map<number, string>(
        (deptsRes.data || []).map((d: { department_id: number; department_name: string }) => [
          d.department_id,
          d.department_name,
        ])
      );

      const employeeMap = new Map<
        number,
        {
          user_id: number;
          user_fname: string;
          user_mname: string | null;
          user_lname: string;
          user_position: string | null;
          department_name: string | null;
          user_dateOfHire: string | null;
        }
      >();

      // 2. Fetch from Spring Boot (primary employee source in masterlist)
      if (SPRING_BASE) {
        try {
          const upstreamUrl = `${SPRING_BASE.replace(/\/+$/, "")}/users`;
          const res = await fetch(upstreamUrl, {
            headers: {
              "Content-Type": "application/json",
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            cache: "no-store",
          });

          if (res.ok) {
            const json = await res.json();
            const rawList: unknown[] = Array.isArray(json) ? json : json?.data || [];
            for (const item of rawList) {
              const u = item as Record<string, unknown>;
              if (!isActiveUser(u)) continue;

              const id = Number(u.id ?? u.user_id);
              if (!id || isNaN(id)) continue;

              let deptName: string | null = null;
              if (typeof u.department === "object" && u.department !== null) {
                deptName =
                  (u.department as { department_name?: string }).department_name || null;
              } else if (typeof u.department === "number") {
                deptName = deptsMap.get(u.department) || null;
              }

              employeeMap.set(id, {
                user_id: id,
                user_fname: String(u.firstName || u.user_fname || ""),
                user_mname: u.middleName
                  ? String(u.middleName)
                  : u.user_mname
                  ? String(u.user_mname)
                  : null,
                user_lname: String(u.lastName || u.user_lname || ""),
                user_position: u.position
                  ? String(u.position)
                  : u.user_position
                  ? String(u.user_position)
                  : null,
                department_name: deptName,
                user_dateOfHire: u.dateOfHire
                  ? String(u.dateOfHire)
                  : u.user_dateOfHire
                  ? String(u.user_dateOfHire)
                  : null,
              });
            }
          }
        } catch (springErr) {
          console.warn("[Service Record] Spring Boot users fetch failed:", springErr);
        }
      }

      // 3. Also fetch from Directus to merge or fallback (using limit=-1 and fields=*)
      try {
        const directusRes = await directusFetch(
          `/items/user?limit=-1&fields=*`
        ).catch(() => ({ data: [] }));

        const dUsers: Record<string, unknown>[] = directusRes.data || [];
        for (const u of dUsers) {
          if (!isActiveUser(u)) continue;

          const id = Number(u.user_id ?? u.id);
          if (!id || isNaN(id)) continue;

          const existing = employeeMap.get(id);
          const deptId =
            typeof u.user_department === "number" ? u.user_department : null;
          const deptName = deptId
            ? deptsMap.get(deptId) || null
            : existing?.department_name || null;

          employeeMap.set(id, {
            user_id: id,
            user_fname: String(
              u.user_fname || existing?.user_fname || u.firstName || ""
            ),
            user_mname: u.user_mname
              ? String(u.user_mname)
              : existing?.user_mname || null,
            user_lname: String(
              u.user_lname || existing?.user_lname || u.lastName || ""
            ),
            user_position: u.user_position
              ? String(u.user_position)
              : existing?.user_position || null,
            department_name: deptName,
            user_dateOfHire: u.user_dateOfHire
              ? String(u.user_dateOfHire)
              : existing?.user_dateOfHire || null,
          });
        }
      } catch (directusErr) {
        console.warn("[Service Record] Directus user fetch failed:", directusErr);
      }

      let allEmployees = Array.from(employeeMap.values());
      if (search) {
        allEmployees = allEmployees.filter((u) => {
          const fullName = `${u.user_fname} ${u.user_mname || ""} ${u.user_lname}`.toLowerCase();
          return fullName.includes(search) || String(u.user_id).includes(search);
        });
      }

      allEmployees.sort((a, b) => {
        const cmp = a.user_lname.localeCompare(b.user_lname);
        return cmp !== 0 ? cmp : a.user_fname.localeCompare(b.user_fname);
      });

      return NextResponse.json({ data: allEmployees });
    }

    // Action 2: Get Single Employee Service Record Profile
    if (!userIdParam) {
      return NextResponse.json({ error: "userId parameter is required" }, { status: 400 });
    }

    const userId = parseInt(userIdParam, 10);
    if (isNaN(userId)) {
      return NextResponse.json({ error: "Invalid userId" }, { status: 400 });
    }

    // 1. Fetch user data (try Directus with fields=*, fallback to Spring Boot)
    let user: Record<string, unknown> | null = null;
    const userRes = await directusFetch(`/items/user/${userId}?fields=*`).catch(() => ({
      data: null,
    }));

    if (userRes.data) {
      user = userRes.data as Record<string, unknown>;
    } else if (SPRING_BASE) {
      // Fallback: try Spring Boot
      try {
        const upstreamUrl = `${SPRING_BASE.replace(/\/+$/, "")}/users/${userId}`;
        const sRes = await fetch(upstreamUrl, {
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          cache: "no-store",
        });
        if (sRes.ok) {
          user = (await sRes.json()) as Record<string, unknown>;
        }
      } catch {
        // Fallback error ignored
      }
    }

    if (!user) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }

    // Fetch department name
    let departmentName: string | null = null;
    const deptId =
      typeof user.user_department === "number"
        ? user.user_department
        : typeof user.department === "number"
        ? user.department
        : null;

    if (deptId) {
      const deptRes = await directusFetch(
        `/items/department/${deptId}?fields=department_name`
      ).catch(() => ({ data: null }));
      departmentName = deptRes.data?.department_name || null;
    } else if (typeof user.department === "object" && user.department !== null) {
      departmentName =
        (user.department as { department_name?: string }).department_name || null;
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
    const separationDate = user.separation_date ?? user.separationDate ?? null;
    const isSeparated = Boolean(
      separationDate && String(separationDate).trim() !== ""
    );
    const isStillInService = !isSeparated && isActiveUser(user);

    return NextResponse.json({
      data: {
        employee: {
          user_id: Number(user.user_id ?? user.id ?? userId),
          user_fname: String(user.user_fname ?? user.firstName ?? ""),
          user_mname: user.user_mname
            ? String(user.user_mname)
            : user.middleName
            ? String(user.middleName)
            : null,
          user_lname: String(user.user_lname ?? user.lastName ?? ""),
          user_maiden_name: user.user_maiden_name
            ? String(user.user_maiden_name)
            : user.maidenName
            ? String(user.maidenName)
            : null,
          user_bday: user.user_bday
            ? String(user.user_bday)
            : user.birthday
            ? String(user.birthday)
            : null,
          user_birth_place: user.user_birth_place
            ? String(user.user_birth_place)
            : user.placeOfBirth
            ? String(user.placeOfBirth)
            : null,
          user_bp_number: user.user_bp_number
            ? String(user.user_bp_number)
            : user.bpNumber
            ? String(user.bpNumber)
            : null,
          user_position: user.user_position
            ? String(user.user_position)
            : user.position
            ? String(user.position)
            : null,
          user_department: deptId,
          department_name: departmentName,
          user_dateOfHire: user.user_dateOfHire
            ? String(user.user_dateOfHire)
            : user.dateOfHire
            ? String(user.dateOfHire)
            : null,
          separation_date: separationDate ? String(separationDate) : null,
          separation_cause: user.separation_cause
            ? String(user.separation_cause)
            : user.separationCause
            ? String(user.separationCause)
            : null,
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
