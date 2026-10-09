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
  source: "oncall" | "department";
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

    const isAdmin = userResponse.data?.isAdmin || userResponse.data?.role === 'ADMIN';

    // Build query - only show logs based on approval status and user department
    const { searchParams } = new URL(req.url);
    const approvalStatus = searchParams.get("approvalStatus") || "all";
    const selectedDepartmentId = searchParams.get("departmentId");
    const filterParts = [];

    if (approvalStatus === "pending") {
      filterParts.push(`filter[_or][0][approve_status][_eq]=pending&filter[_or][1][approve_status][_null]=true`);
    } else if (approvalStatus && approvalStatus !== "all") {
      filterParts.push(`filter[approve_status][_eq]=${approvalStatus}`);
    }

    // Add date range filter if provided
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    if (startDate) filterParts.push(`filter[log_date][_gte]=${startDate}`);
    if (endDate) filterParts.push(`filter[log_date][_lte]=${endDate}`);

    // Department filtering logic:
    // 1. If a specific department is selected, use it.
    // 2. Otherwise, if the user is NOT an admin, restrict to their authorized departments.
    let assignedDepartmentIds: number[] = [];
    if (selectedDepartmentId && selectedDepartmentId !== "all") {
      filterParts.push(`filter[department_id][_eq]=${selectedDepartmentId}`);
    } else {
      const taApproversRes = await directusFetch(
        `/items/ta_draft_approvers?filter[approver_id][_eq]=${userId}&filter[is_deleted][_eq]=0&fields=department_id`
      ).catch(() => ({ data: [] }));
      
      const taApprovers = taApproversRes.data || [];
      assignedDepartmentIds = taApprovers.map((ta: { department_id: number }) => ta.department_id).filter(Boolean);

      const skipFilter = isAdmin && assignedDepartmentIds.length === 0;

      if (!skipFilter) {
        if (assignedDepartmentIds.length > 0) {
          const deptIdsString = assignedDepartmentIds.join(',');
          filterParts.push(`filter[department_id][_in]=${deptIdsString}`);
        } else {
          filterParts.push(`filter[department_id][_in]=-1`);
        }
      }
    }

    const isDailyApproval = Boolean(startDate && endDate && startDate === endDate);
    const targetDate = startDate || "";

    const filter = filterParts.join("&");
    // Only include fields that actually exist in the attendance_log table.
    // Calculations like work_minutes, late_minutes etc. are done in the mapping function.
    const logFields = "log_id,user_id,department_id,log_date,time_in,time_out,approve_status,status";
    const finalUrl = `/items/attendance_log?${filter}${filter ? "&" : ""}sort=-log_date&limit=1000&fields=${logFields}`;

    // Fetch attendance logs
    const attendanceResponse = await directusFetch(finalUrl).catch(() => ({ data: [] }));
    const logs = attendanceResponse.data || [];

    // Helper to check soft-deleted users in Directus
    const isDeletedUser = (val: unknown): boolean => {
      if (typeof val === 'boolean') return val;
      if (typeof val === 'number') return val !== 0;
      if (val && typeof val === 'object') {
        const buf = val as { type?: string; data?: number[] };
        if (buf.type === 'Buffer' && Array.isArray(buf.data)) {
          return buf.data[0] === 1;
        }
      }
      return false;
    };

    // Helper to check flexible schedule users in Directus
    const isFlexibleScheduleUser = (val: unknown): boolean => {
      if (typeof val === 'boolean') return val;
      if (typeof val === 'number') return val !== 0;
      if (val === '1' || val === 'true') return true;
      if (val && typeof val === 'object') {
        const buf = val as { type?: string; data?: number[] };
        if (buf.type === 'Buffer' && Array.isArray(buf.data)) {
          return buf.data[0] === 1;
        }
      }
      return false;
    };

    interface UserDetails {
      user_id: number;
      user_fname: string;
      user_lname: string;
      user_mname: string | null;
      user_department: number | null;
      is_employee?: unknown;
      is_deleted?: unknown;
      is_flexible_schedule?: unknown;
    }

    // Fetch all users to have details and identify absent active employees
    const usersResponse = await directusFetch(
      `/items/user?limit=-1&fields=user_id,user_fname,user_lname,user_mname,user_department,is_employee,is_deleted,is_flexible_schedule`
    ).catch(() => ({ data: [] }));

    const allUsers: UserDetails[] = usersResponse.data || [];

    const usersMap = new Map<number, UserDetails>(
      allUsers.map((u: UserDetails) => [u.user_id, u])
    );

    // Filter active employees
    const activeEmployees = allUsers.filter((u: UserDetails) =>
      !isDeletedUser(u.is_deleted) && (u.is_employee === 1 || u.is_employee === true)
    );

    // Filter active employees by selected/authorized department
    let eligibleEmployees = activeEmployees;
    if (selectedDepartmentId && selectedDepartmentId !== "all") {
      eligibleEmployees = eligibleEmployees.filter((u: UserDetails) =>
        String(u.user_department) === String(selectedDepartmentId)
      );
    } else if (!isAdmin || assignedDepartmentIds.length > 0) {
      if (assignedDepartmentIds.length > 0) {
        const allowedDeptSet = new Set(assignedDepartmentIds.map(String));
        eligibleEmployees = eligibleEmployees.filter((u: UserDetails) =>
          u.user_department && allowedDeptSet.has(String(u.user_department))
        );
      } else {
        eligibleEmployees = [];
      }
    }

    if (logs.length === 0 && (!isDailyApproval || eligibleEmployees.length === 0)) {
      return NextResponse.json({ data: [], total: 0 });
    }

    // Fetch department details in one batch request
    interface DeptDetails {
      department_id: number;
      department_name: string;
    }

    const deptsResponse = await directusFetch(
      `/items/department?limit=-1&fields=department_id,department_name`
    ).catch(() => ({ data: [] }));

    const deptsMap = new Map<number, DeptDetails>(
      (deptsResponse.data || []).map((d: DeptDetails) => [d.department_id, d])
    );

    // Relevant user IDs for metadata lookups (both logged and eligible absent employees)
    const allRelevantUserIds = Array.from(new Set([
      ...logs.map((l: AttendanceLog) => l.user_id),
      ...(isDailyApproval ? eligibleEmployees.map((e: UserDetails) => e.user_id) : [])
    ]));

    const userIdsFilter = allRelevantUserIds.length > 0 ? `filter[user_id][_in]=${allRelevantUserIds.join(",")}` : "";
    const approvalFilter = allRelevantUserIds.length > 0
      ? (isDailyApproval
          ? `filter[employee_id][_in]=${allRelevantUserIds.join(",")}&filter[date_schedule][_eq]=${targetDate}&limit=1000`
          : `filter[employee_id][_in]=${allRelevantUserIds.join(",")}&limit=1000`)
      : (isDailyApproval ? `filter[date_schedule][_eq]=${targetDate}&limit=1000` : `limit=1000`);

    const [deptSchedulesRes, oncallListsRes, oncallSchedulesRes, approvalsRes, otRequestsRes, generalSettingRes] = await Promise.all([
      directusFetch(`/items/department_schedule?limit=1000&fields=department_id,work_start,work_end,lunch_start,lunch_end,break_start,break_end,grace_period`),
      directusFetch(`/items/oncall_list?${userIdsFilter}&limit=1000&fields=user_id,dept_sched_id`),
      directusFetch(`/items/oncall_schedule?limit=1000&fields=id,department_id,group,work_start,work_end,lunch_start,lunch_end,break_start,break_end,grace_period,schedule_date,workdays`),
      directusFetch(`/items/attendance_approval?${approvalFilter}&fields=approval_id,employee_id,date_schedule,status,remarks,work_minutes,late_minutes,undertime_minutes,overtime_minutes`),
      directusFetch(`/items/overtime_request?${userIdsFilter}&filter[status][_eq]=approved&limit=1000&fields=user_id,request_date,status`),
      directusFetch(`/items/general_setting?filter[setting_key][_eq]=payroll_no_time_out_undertime_amount&fields=setting_key,setting_value&limit=1`).catch(() => ({ data: [] }))
    ]);

    // Parse penalty for missing time out from general_setting (defaults to 240 if missing/invalid)
    let noTimeOutUndertimePenalty = 240;
    const noTimeOutSetting = generalSettingRes?.data?.[0];
    if (
      noTimeOutSetting &&
      noTimeOutSetting.setting_value !== undefined &&
      noTimeOutSetting.setting_value !== null &&
      String(noTimeOutSetting.setting_value).trim() !== ""
    ) {
      const parsed = Number(noTimeOutSetting.setting_value);
      if (!isNaN(parsed) && parsed >= 0) {
        noTimeOutUndertimePenalty = parsed;
      }
    }

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

    const getEmployeeSchedule = (userIdParam: number, userDeptIdParam: number | null | undefined, dateStr: string): Sched | null => {
      const userOncallEntries = oncallList.filter((entry: { user_id: number; dept_sched_id: number }) =>
        String(entry.user_id) === String(userIdParam)
      );

      if (userOncallEntries.length > 0) {
        for (const entry of userOncallEntries) {
          const ocSched = oncallSchedules.find((s: OncallScheduleRecord) => {
            if (String(s.id) !== String(entry.dept_sched_id)) return false;

            if (s.schedule_date && dateStr) {
              const schedDateOnly = s.schedule_date.split('T')[0];
              const logDateOnly = dateStr.split('T')[0];

              if (schedDateOnly === logDateOnly) return true;

              const schedDate = parseISO(schedDateOnly);
              const logDate = parseISO(logDateOnly);

              if (isSameISOWeek(schedDate, logDate)) {
                const dayOfWeek = format(logDate, "EEEE");
                return s.workdays?.includes(dayOfWeek);
              }
            }
            return false;
          });

          if (ocSched) {
            return {
              time_in: ocSched.work_start,
              time_out: ocSched.work_end,
              grace_period: Number(ocSched.grace_period ?? 5),
              source: "oncall",
            };
          }
        }
      }

      if (userDeptIdParam) {
        const deptSched = deptSchedules.find((s: DepartmentScheduleRecord) =>
          String(s.department_id) === String(userDeptIdParam)
        );

        if (deptSched) {
          return {
            time_in: deptSched.work_start,
            time_out: deptSched.work_end,
            grace_period: Number(deptSched.grace_period ?? 5),
            source: "department",
          };
        }
      }

      return null;
    };

    // Combine data for logged employees
    const enrichedLogs = logs.map((log: AttendanceLog) => {
      const user = usersMap.get(log.user_id);
      const dept = log.department_id ? deptsMap.get(log.department_id) : (user?.user_department ? deptsMap.get(user.user_department) : null);
      const userDeptId = user?.user_department || log.department_id;

      const schedule = getEmployeeSchedule(log.user_id, userDeptId, log.log_date);
      const isFlexible = isFlexibleScheduleUser(user?.is_flexible_schedule);
      const isExemptFromLate = isFlexible && schedule?.source === "department";

      let work_minutes = 0;
      let late_minutes = 0;
      let undertime_minutes = 0;
      let overtime_minutes = 0;

      if (log.time_in && schedule) {
        const actualIn = parseLocalISO(log.time_in);
        const schedIn = timeToDate(log.log_date, schedule.time_in);
        let schedOut = timeToDate(log.log_date, schedule.time_out);
        if (schedOut < schedIn) {
          schedOut = new Date(schedOut.getTime() + 24 * 60 * 60 * 1000);
        }

        let actualOut: Date | null = null;
        if (log.time_out) {
          actualOut = parseLocalISO(log.time_out);
          // If actualOut is before actualIn, the punch crossed midnight into the next day
          if (actualOut < actualIn) {
            actualOut = new Date(actualOut.getTime() + 24 * 60 * 60 * 1000);
          }
        }

        if (actualIn > schedOut) {
          // LATE TIME IN BEYOND TIME OUT LOGIC:
          // Cap late to 240 (half day) unless exempt via flexible schedule on department schedule
          late_minutes = isExemptFromLate ? 0 : 240;
          work_minutes = 480;
          overtime_minutes = 0;

          if (isExemptFromLate) {
            // Flexible schedule employees are exempt from department schedule undertime
            undertime_minutes = 0;
          } else if (actualOut) {
            if (actualOut < schedOut) {
              undertime_minutes = Math.floor((schedOut.getTime() - actualOut.getTime()) / 60000);
            } else {
              undertime_minutes = 0;
            }
          } else {
            // Missing time out logic: Penalty based on general_setting (defaults to 240 if missing)
            if (late_minutes + noTimeOutUndertimePenalty > 480) {
              undertime_minutes = Math.max(0, 480 - late_minutes);
            } else {
              undertime_minutes = noTimeOutUndertimePenalty;
            }
          }
        } else {
          // ALWAYS calculate Lateness if they timed in before scheduled time out
          const diffInMs = actualIn.getTime() - schedIn.getTime();
          const diffInMins = Math.floor(diffInMs / 60000);

          if (!isExemptFromLate && diffInMins > schedule.grace_period) {
            late_minutes = diffInMins;
          } else {
            late_minutes = 0;
          }

          // Base Work Time (Fixed 480 for HR system compliance)
          work_minutes = 480;

          if (actualOut) {
            // Undertime: exempt if flexible schedule on department schedule
            if (isExemptFromLate) {
              undertime_minutes = 0;
            } else if (actualOut < schedOut) {
              undertime_minutes = Math.floor((schedOut.getTime() - actualOut.getTime()) / 60000);
            } else {
              undertime_minutes = 0;
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
            // Penalty is based on general_setting 'payroll_no_time_out_undertime_amount'
            // (defaults to 240 if missing).
            // Balancing logic: Late + UT should not exceed 480.
            if (isExemptFromLate) {
              undertime_minutes = 0;
            } else if (late_minutes + noTimeOutUndertimePenalty > 480) {
              undertime_minutes = Math.max(0, 480 - late_minutes);
            } else {
              undertime_minutes = noTimeOutUndertimePenalty;
            }
            overtime_minutes = 0;
          }
        }
      }

      // 3. OVERRIDE with manual adjustments if they exist in attendance_approval
      const approvalKey = `${log.user_id}_${log.log_date.split('T')[0]}`;
      const manualAdjustments = approvalsMap.get(approvalKey);

      if (manualAdjustments) {
        const isStaleManualRecord =
          log.approve_status === "pending" &&
          manualAdjustments.work_minutes < work_minutes &&
          !manualAdjustments.remarks;

        if (!isStaleManualRecord) {
          work_minutes = manualAdjustments.work_minutes ?? work_minutes;
          late_minutes = manualAdjustments.late_minutes ?? late_minutes;
          undertime_minutes = manualAdjustments.undertime_minutes ?? undertime_minutes;
          overtime_minutes = manualAdjustments.overtime_minutes ?? overtime_minutes;
        }
      }

      const derivedStatus = manualAdjustments?.status || log.approve_status || "pending";

      let computedStatus = manualAdjustments?.remarks || log.status || (log.time_in ? "On Time" : "Absent");
      if (isExemptFromLate && computedStatus === "Late" && !manualAdjustments?.remarks) {
        computedStatus = "On Time";
      }

      return {
        ...log,
        approval_status: derivedStatus.toLowerCase(),
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
        status: computedStatus,
        is_flexible_schedule: isFlexible,
      };
    });

    // Synthesize records for absent active employees (0 0 0 0 minutes) in Daily Approval
    const loggedUserIds = new Set(logs.map((l: AttendanceLog) => l.user_id));
    const absentLogs: typeof enrichedLogs = [];

    if (isDailyApproval) {
      for (const emp of eligibleEmployees) {
        if (loggedUserIds.has(emp.user_id)) continue;

        const schedule = getEmployeeSchedule(emp.user_id, emp.user_department, targetDate);
        const dept = emp.user_department ? deptsMap.get(emp.user_department) : null;

        const approvalKey = `${emp.user_id}_${targetDate.split('T')[0]}`;
        const manualAdjustments = approvalsMap.get(approvalKey);

        let work_minutes = 0;
        let late_minutes = 0;
        let undertime_minutes = 0;
        let overtime_minutes = 0;
        let derivedStatus = "pending";
        let statusRemarks = "Absent";

        if (manualAdjustments) {
          work_minutes = manualAdjustments.work_minutes ?? 0;
          late_minutes = manualAdjustments.late_minutes ?? 0;
          undertime_minutes = manualAdjustments.undertime_minutes ?? 0;
          overtime_minutes = manualAdjustments.overtime_minutes ?? 0;
          derivedStatus = manualAdjustments.status || "pending";
          statusRemarks = manualAdjustments.remarks || "Absent";
        }

        const isFlexible = isFlexibleScheduleUser(emp.is_flexible_schedule);

        absentLogs.push({
          log_id: -(emp.user_id),
          user_id: emp.user_id,
          department_id: emp.user_department ?? 0,
          log_date: targetDate,
          time_in: null,
          time_out: null,
          lunch_start: null,
          lunch_end: null,
          break_start: null,
          break_end: null,
          status: statusRemarks,
          approval_status: derivedStatus.toLowerCase(),
          approve_status: derivedStatus.toLowerCase(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          user_fname: emp.user_fname || "Unknown",
          user_lname: emp.user_lname || "",
          user_mname: emp.user_mname || null,
          department_name: dept?.department_name || null,
          work_minutes,
          late_minutes,
          undertime_minutes,
          overtime_minutes,
          sched_time_in: schedule?.time_in || null,
          sched_time_out: schedule?.time_out || null,
          is_flexible_schedule: isFlexible,
        });
      }
    }

    const allEnrichedLogs = [...enrichedLogs, ...absentLogs];

    let finalLogs = allEnrichedLogs;
    if (approvalStatus && approvalStatus !== "all") {
      finalLogs = allEnrichedLogs.filter((log: { approval_status?: string; [key: string]: unknown }) => log.approval_status === approvalStatus.toLowerCase());
    }

    return NextResponse.json({
      data: finalLogs,
      total: finalLogs.length,
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

    // Process items safely
    for (const item of items) {
      const { log_id, employee_id, date_schedule, status, remarks, work_minutes, late_minutes, undertime_minutes, overtime_minutes } = item;
      const cleanDate = date_schedule ? date_schedule.split('T')[0] : null;

      if (!status || !['approved', 'rejected', 'pending'].includes(status) || !employee_id || !cleanDate) {
        results.push({ log_id, success: false, error: "Missing required fields" });
        continue;
      }

      // 1. Update or create the attendance log
      if (log_id && log_id > 0) {
        await directusFetch(`/items/attendance_log/${log_id}`, {
          method: "PATCH",
          body: JSON.stringify({ approve_status: status }),
        }).catch((err) => {
          console.warn(`[Attendance Approval] Failed to update attendance_log ${log_id}:`, err);
        });
      } else {
        // Employee was absent/had no attendance_log initially.
        // Check if an attendance_log was already created for this user and date
        const existingLogRes = await directusFetch(
          `/items/attendance_log?filter[user_id][_eq]=${employee_id}&filter[log_date][_eq]=${cleanDate}&limit=1&fields=log_id`
        ).catch(() => ({ data: [] }));

        const existingLog = existingLogRes.data?.[0];
        if (existingLog) {
          await directusFetch(`/items/attendance_log/${existingLog.log_id}`, {
            method: "PATCH",
            body: JSON.stringify({ approve_status: status, status: remarks || 'Absent' }),
          }).catch((err) => console.warn(`[Attendance Approval] Update log error:`, err));
        } else {
          // Fetch employee's department_id
          const empRes = await directusFetch(`/items/user/${employee_id}?fields=user_department`).catch(() => ({ data: {} }));
          const deptId = empRes.data?.user_department || 1;
          await directusFetch(`/items/attendance_log`, {
            method: "POST",
            body: JSON.stringify({
              user_id: employee_id,
              department_id: deptId,
              log_date: cleanDate,
              time_in: null,
              time_out: null,
              status: remarks || 'Absent',
              approve_status: status
            }),
          }).catch((err) => console.warn(`[Attendance Approval] Create absent log error:`, err));
        }
      }

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
        remarks: remarks || "Absent",
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
