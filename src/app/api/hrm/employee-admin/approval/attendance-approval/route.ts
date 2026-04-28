import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { format, isSameISOWeek, parseISO } from "date-fns";

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

interface AttendanceLog {
  log_id: number;
  user_id: number;
  department_id: number;
  log_date: string;
  time_in: string | null;
  time_out: string | null;
  approve_status: string;
  [key: string]: unknown;
}

interface Sched {
  time_in: string;
  time_out: string;
  grace_period: number;
}

function timeToDate(dateStr: string, timeStr: string): Date {
  const datePart = dateStr.split('T')[0];
  const [y, mm, d] = datePart.split("-").map(Number);
  const [h, m, s] = timeStr.split(":").map(Number);
  // Using multi-argument constructor treats as local time
  return new Date(y, mm - 1, d, h, m, s || 0);
}

function parseLocalISO(isoStr: string): Date {
  if (!isoStr.includes('T')) return new Date(isoStr);
  const [datePart, timePart] = isoStr.split('T');
  const [y, mm, d] = datePart.split("-").map(Number);
  const [h, m, s] = timePart.replace('Z', '').split(":").map(Number);
  return new Date(y, mm - 1, d, h, m, Math.floor(s || 0));
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

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

// ============================================================================
// GET - Fetch Attendance Logs (Pending, filtered by department)
// ============================================================================

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

    // Fetch user details to get department

    const userResponse = await directusFetch(
      `/items/user/${userId}?fields=user_id,user_department,isAdmin,role`
    );

    const currentUserDepartment = userResponse.data?.user_department;
    const isAdmin = userResponse.data?.isAdmin || userResponse.data?.role === 'ADMIN';

    // Build query - only show logs based on approval status and user department
    const { searchParams } = new URL(req.url);
    const approvalStatus = searchParams.get("approvalStatus") || "all";
    const selectedDepartmentId = searchParams.get("departmentId");
    const filterParts = [];

    if (approvalStatus && approvalStatus !== "all") {
      filterParts.push(`filter[approve_status][_eq]=${approvalStatus}`);
    }

    // Add date range filter if provided
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    if (startDate) filterParts.push(`filter[log_date][_gte]=${startDate}`);
    if (endDate) filterParts.push(`filter[log_date][_lte]=${endDate}`);

    // Department filtering logic:
    // 1. If a specific department is selected, use it.
    // 2. Otherwise, if the user is NOT an admin, restrict to their department.
    if (selectedDepartmentId && selectedDepartmentId !== "all") {
      filterParts.push(`filter[department_id][_eq]=${selectedDepartmentId}`);
    } else if (currentUserDepartment && !isAdmin) {
      filterParts.push(`filter[department_id][_eq]=${currentUserDepartment}`);
    }

    const filter = filterParts.join("&");
    // Only include fields that actually exist in the attendance_log table.
    // Calculations like work_minutes, late_minutes etc. are done in the mapping function.
    const logFields = "log_id,user_id,department_id,log_date,time_in,time_out,approve_status,status";
    const finalUrl = `/items/attendance_log?${filter}${filter ? "&" : ""}sort=-log_date&limit=1000&fields=${logFields}`;


    // Fetch attendance logs
    const attendanceResponse = await directusFetch(finalUrl);


    const logs = attendanceResponse.data || [];

    if (logs.length === 0) {
      return NextResponse.json({ data: [], total: 0 });
    }

    // Fetch user details for all logs in one batch request
    const userIds = [...new Set(logs.map((l: AttendanceLog) => l.user_id))] as number[];
    const usersResponse = await directusFetch(
      `/items/user?filter[user_id][_in]=${userIds.join(",")}&fields=user_id,user_fname,user_lname,user_mname,user_department`
    ).catch(() => ({ data: [] }));

    interface UserDetails {
      user_id: number;
      user_fname: string;
      user_lname: string;
      user_mname: string | null;
      user_department: number | null;
    }

    const usersMap = new Map<number, UserDetails>(
      (usersResponse.data || []).map((u: UserDetails) => [u.user_id, u])
    );

    // Fetch department details in one batch request
    const deptIds = [...new Set(logs.map((l: AttendanceLog) => l.department_id).filter(Boolean))] as number[];
    const deptsResponse = await directusFetch(
      `/items/department?filter[department_id][_in]=${deptIds.join(",")}&fields=department_id,department_name`
    ).catch(() => ({ data: [] }));

    interface DeptDetails {
      department_id: number;
      department_name: string;
    }

    const deptsMap = new Map<number, DeptDetails>(
      (deptsResponse.data || []).map((d: DeptDetails) => [d.department_id, d])
    );

    // Optimized metadata fetches with specific fields and filtered by userIds/deptIds where possible
    // Only perform filtered fetches if we have IDs, otherwise fetch with default limit
    const userIdsFilter = userIds.length > 0 ? `filter[user_id][_in]=${userIds.join(",")}` : "";

    const [deptSchedulesRes, oncallListsRes, oncallSchedulesRes, approvalsRes, otRequestsRes] = await Promise.all([
      directusFetch(`/items/department_schedule?limit=1000&fields=department_id,work_start,work_end,lunch_start,lunch_end,break_start,break_end,grace_period`),
      directusFetch(`/items/oncall_list?${userIdsFilter}&limit=1000&fields=user_id,dept_sched_id`),
      directusFetch(`/items/oncall_schedule?limit=1000&fields=id,department_id,group,work_start,work_end,lunch_start,lunch_end,break_start,break_end,grace_period,schedule_date,workdays`),
      directusFetch(`/items/attendance_approval?${userIds.length > 0 ? `filter[employee_id][_in]=${userIds.join(",")}` : ""}&limit=1000&fields=approval_id,employee_id,date_schedule,status,remarks,work_minutes,late_minutes,undertime_minutes,overtime_minutes`),
      directusFetch(`/items/overtime_request?${userIdsFilter}&filter[status][_eq]=approved&limit=1000&fields=user_id,request_date,status`)
    ]);

    const deptSchedules = deptSchedulesRes.data || [];
    const oncallList = oncallListsRes.data || [];
    const oncallSchedules = oncallSchedulesRes.data || [];
    const approvalsList = approvalsRes.data || [];
    const otRequestsList = otRequestsRes.data || [];

    // Create a map for quick approval lookup by employee_id and date
    interface AttendanceApprovalRecord {
      approval_id: number;
      employee_id: number;
      date_schedule: string;
      status: string;
      remarks: string | null;
      work_minutes: number;
      late_minutes: number;
      undertime_minutes: number;
      overtime_minutes: number;
    }

    const approvalsMap = new Map<string, AttendanceApprovalRecord>();
    approvalsList.forEach((app: AttendanceApprovalRecord) => {
      const key = `${app.employee_id}_${app.date_schedule.split('T')[0]}`;
      approvalsMap.set(key, app);
    });

    // Create a map for quick OT request lookup by user_id and date
    interface OTRequestRecord {
      user_id: number;
      request_date: string;
      status: string;
    }

    const otRequestsMap = new Map<string, OTRequestRecord>();
    otRequestsList.forEach((req: OTRequestRecord) => {
      const key = `${req.user_id}_${req.request_date}`;
      otRequestsMap.set(key, req);
    });

    // Combine data
    const enrichedLogs = logs.map((log: AttendanceLog) => {
      const user = usersMap.get(log.user_id);
      const dept = log.department_id ? deptsMap.get(log.department_id) : null;

      // const dayOfWeek = format(new Date(log.log_date), "EEEE");
      const userDeptId = user?.user_department;



      // 1. Check Oncall Priority
      const userOncallEntries = oncallList.filter((entry: { user_id: number; dept_sched_id: number }) =>
        String(entry.user_id) === String(log.user_id)
      );

      let schedule: Sched | null = null;

      if (userOncallEntries.length > 0) {

        for (const entry of userOncallEntries) {
          // As verified by user example (Turn 446): oncall_list.dept_sched_id connects to oncall_schedule.id
          // The oncall schedule must only apply if its schedule_date matches the log's date
          interface OncallScheduleRecord {
            id: number;
            department_id: number;
            group: string;
            work_start: string;
            work_end: string;
            lunch_start: string;
            lunch_end: string;
            break_start: string;
            break_end: string;
            grace_period: number;
            schedule_date: string | null;
            workdays: string | null;
          }
          const ocSched = oncallSchedules.find((s: OncallScheduleRecord) => {
            if (String(s.id) !== String(entry.dept_sched_id)) return false;
            
            if (s.schedule_date && log.log_date) {
              const schedDateOnly = s.schedule_date.split('T')[0];
              const logDateOnly = log.log_date.split('T')[0];
              
              // 1. Strict Date Match: If exactly the same date, it applies.
              if (schedDateOnly === logDateOnly) return true;

              // 2. Weekly Catchment Logic (User example: March 25 Start + Thu/Fri selected)
              // Match if in the same ISO week AND the specific day is checked in the record.
              const schedDate = parseISO(schedDateOnly);
              const logDate = parseISO(logDateOnly);

              if (isSameISOWeek(schedDate, logDate)) {
                const dayOfWeek = format(logDate, "EEEE"); // e.g., "Thursday"
                return s.workdays?.includes(dayOfWeek);
              }
            }
            return false;
          });

          if (ocSched) {

            schedule = {
              time_in: ocSched.work_start,
              time_out: ocSched.work_end,
              grace_period: Number(ocSched.grace_period ?? 5)
            };

            break;
          }
        }
      }

      // 2. Fallback to Department Schedule
      if (!schedule && userDeptId) {
        interface DepartmentScheduleRecord {
          department_id: number;
          work_start: string;
          work_end: string;
          lunch_start: string;
          lunch_end: string;
          break_start: string;
          break_end: string;
          grace_period: number;
        }
        const deptSched = deptSchedules.find((s: DepartmentScheduleRecord) =>
          String(s.department_id) === String(userDeptId)
        );

        if (deptSched) {

          schedule = {
            time_in: deptSched.work_start,
            time_out: deptSched.work_end,
            grace_period: Number(deptSched.grace_period ?? 5)
          };

        }
      }

      if (!schedule) {

      }

      let work_minutes = 0;
      let late_minutes = 0;
      let undertime_minutes = 0;
      let overtime_minutes = 0;

      if (log.time_in && schedule) {
        const actualIn = parseLocalISO(log.time_in);
        const schedIn = timeToDate(log.log_date, schedule.time_in);
        const schedOut = timeToDate(log.log_date, schedule.time_out);

        if (actualIn > schedOut) {
          // LATE TIME IN BEYOND TIME OUT LOGIC:
          // Cap late and undertime to 240 each, work 480 (Total 480 deduction, net 0)
          late_minutes = 240;
          undertime_minutes = 240;
          work_minutes = 480;
          overtime_minutes = 0;

        } else {
          // ALWAYS calculate Lateness if they timed in before scheduled time out
          const diffInMs = actualIn.getTime() - schedIn.getTime();
          const diffInMins = Math.floor(diffInMs / 60000);

          if (diffInMins > schedule.grace_period) {
            late_minutes = diffInMins;
          } else {
            late_minutes = 0;
          }

          // Base Work Time (Fixed 480 for HR system compliance)
          work_minutes = 480;

          if (log.time_out) {
            const actualOut = parseLocalISO(log.time_out);

            // Undertime
            if (actualOut < schedOut) {
              undertime_minutes = Math.floor((schedOut.getTime() - actualOut.getTime()) / 60000);
            }

            // Overtime: if timed out 90m (1.5h) excess AND has approved overtime_request
            const excessOut = Math.floor((actualOut.getTime() - schedOut.getTime()) / 60000);
            const dayKey = log.log_date.split('T')[0];
            const otReq = otRequestsMap.get(`${log.user_id}_${dayKey}`);

            if (excessOut >= 90 && otReq?.status === 'approved') {
              overtime_minutes = excessOut;
            } else {
              overtime_minutes = 0;
            }
          } else {
            // MISSING TIME OUT LOGIC: 
            // Pay for the whole day (480), but deduct half day (at least 240 undertime)
            // Balancing logic: Late + UT should not exceed 480.
            if (late_minutes > 240) {
              undertime_minutes = 480 - late_minutes;
            } else {
              undertime_minutes = 240;
            }
            overtime_minutes = 0;

          }
        }
      }

      // 3. OVERRIDE with manual adjustments if they exist in attendance_approval
      const approvalKey = `${log.user_id}_${log.log_date.split('T')[0]}`;
      const manualAdjustments = approvalsMap.get(approvalKey);

      if (manualAdjustments) {


        // If it's a pending log, we might want to favor calculation if the manual record
        // looks like it was saved with 'stale' values due to the previous calculation bug.
        // If calculation shows more minutes and there are no manual remarks, we favor calculation.
        const isStaleManualRecord =
          log.approve_status === "pending" &&
          manualAdjustments.work_minutes < work_minutes &&
          !manualAdjustments.remarks;

        if (!isStaleManualRecord) {
          work_minutes = manualAdjustments.work_minutes ?? work_minutes;
          late_minutes = manualAdjustments.late_minutes ?? late_minutes;
          undertime_minutes = manualAdjustments.undertime_minutes ?? undertime_minutes;
          overtime_minutes = manualAdjustments.overtime_minutes ?? overtime_minutes;
        } else {

        }
      }

      return {
        ...log,
        approval_status: log.approve_status,
        user_fname: user?.user_fname || "Unknown",
        user_lname: user?.user_lname || "",
        user_mname: user?.user_mname || null,
        department_name: dept?.department_name || null,
        work_minutes,
        late_minutes,
        undertime_minutes,
        overtime_minutes,
        sched_time_in: schedule?.time_in || null,
        sched_time_out: schedule?.time_out || null,
        status: manualAdjustments?.remarks || log.status // Use manual remarks if available
      };
    });

    return NextResponse.json({
      data: enrichedLogs,
      total: enrichedLogs.length,
    });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    console.error("GET attendance_log error: - route.ts:440", error);
    return NextResponse.json(
      { error: "Failed to fetch attendance logs", details: errorMsg },
      { status: 500 }
    );
  }
}

// ============================================================================
// PATCH - Approve or Reject Attendance Log (Supports single or batch)
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

    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized: Invalid token payload" },
        { status: 401 }
      );
    }
    const body = await req.json();

    // Support both single object and array of objects
    const items = Array.isArray(body) ? body : [body];
    console.log(`[BACKEND] Processing ${items.length} items in PATCH request - route.ts:476`);

    if (items.length === 0) {
      return NextResponse.json({ error: "No items provided" }, { status: 400 });
    }

    const results = [];

    // For large batches, we could optimize this further with Directus batch endpoints,
    // but for now, we'll process them in the most stable way.
    for (const item of items) {
      const { log_id, employee_id, date_schedule, status, remarks, work_minutes, late_minutes, undertime_minutes, overtime_minutes } = item;
      const cleanDate = date_schedule ? date_schedule.split('T')[0] : null;

      if (!log_id || !status || !['approved', 'rejected', 'pending'].includes(status) || !employee_id || !cleanDate) {
        results.push({ log_id, success: false, error: "Missing required fields" });
        continue;
      }

      // 1. Update the attendance log status
      await directusFetch(`/items/attendance_log/${log_id}`, {
        method: "PATCH",
        body: JSON.stringify({ approve_status: status }),
      });

      // 2. Upsert the approval record
      const filter = `filter[employee_id][_eq]=${employee_id}&filter[date_schedule][_eq]=${cleanDate}`;
      const existingApprovalRes = await directusFetch(`/items/attendance_approval?${filter}&fields=approval_id`);
      const existingApproval = existingApprovalRes.data?.[0];

      interface ApprovalPOSTData {
        employee_id: number;
        date_schedule: string;
        approved_by: number;
        approved_at: string;
        work_minutes: number;
        late_minutes: number;
        undertime_minutes: number;
        overtime_minutes: number;
        remarks: string | null;
        status?: string;
      }

      const approvalData: ApprovalPOSTData = {
        employee_id,
        date_schedule: cleanDate,
        approved_by: userId,
        approved_at: new Date().toISOString(),
        work_minutes: work_minutes ?? 0,
        late_minutes: late_minutes ?? 0,
        undertime_minutes: undertime_minutes ?? 0,
        overtime_minutes: overtime_minutes ?? 0,
        remarks: remarks || null,
      };

      if (status !== 'pending') approvalData.status = status;

      if (existingApproval) {
        await directusFetch(`/items/attendance_approval/${existingApproval.approval_id}`, {
          method: "PATCH",
          body: JSON.stringify(approvalData),
        });
      } else {
        await directusFetch(`/items/attendance_approval`, {
          method: "POST",
          body: JSON.stringify(approvalData),
        });
      }

      results.push({ log_id, success: true });
    }

    return NextResponse.json({
      success: true,
      processed: items.length,
      results
    });
  } catch (error) {
    console.error("PATCH attendance_log error: - route.ts:554", error);
    return NextResponse.json(
      { error: "Failed to update attendance logs" },
      { status: 500 }
    );
  }
}
