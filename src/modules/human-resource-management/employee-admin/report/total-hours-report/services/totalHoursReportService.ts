import { format, parseISO } from "date-fns";
import type {
  TotalHoursRecord,
  TotalHoursSummary,
  User,
  Department,
  PaginationState,
  DepartmentMatrixData,
  MatrixEmployeeRow,
  MatrixDayData,
} from "../type";

const DIRECTUS_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

export interface TotalHoursServiceParams {
  userId: number;
  userRole?: string;
  isAdminUser?: boolean;
  page: number;
  pageSize: number;
  search?: string;
  dateFrom?: string; // YYYY-MM-DD
  dateTo?: string; // YYYY-MM-DD
  departmentId?: string | number | null;
  nameFilter?: string;
  approvalStatus?: string; // 'approved' | 'all' | 'rejected'
}

function formatHM(minutes: number): string {
  if (!minutes || minutes <= 0) return "0h 0m";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m}m`;
}

function formatClockTime(isoStr: string | null | undefined): string {
  if (!isoStr) return "No punch";
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) {
      if (isoStr.includes(":")) {
        const [h, m] = isoStr.split(":");
        const hour = parseInt(h, 10);
        const ampm = hour >= 12 ? "PM" : "AM";
        const h12 = hour % 12 || 12;
        return `${String(h12).padStart(2, "0")}:${m} ${ampm}`;
      }
      return isoStr;
    }
    return format(d, "hh:mm a");
  } catch {
    return isoStr;
  }
}

function getDatesInRange(startDateStr: string, endDateStr: string): string[] {
  const dates: string[] = [];
  const curr = parseISO(startDateStr);
  const end = parseISO(endDateStr);

  if (isNaN(curr.getTime()) || isNaN(end.getTime())) return [];

  const temp = new Date(curr);
  let count = 0;
  while (temp <= end && count < 35) {
    dates.push(format(temp, "yyyy-MM-dd"));
    temp.setDate(temp.getDate() + 1);
    count++;
  }
  return dates;
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
    next: { revalidate: 0 },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Directus API error: ${response.status} - ${error}`);
  }

  return response.json();
}

export async function fetchTotalHoursReport(params: TotalHoursServiceParams) {
  const {
    userId,
    page = 1,
    pageSize = 10,
    search = "",
    dateFrom = "",
    dateTo = "",
    departmentId,
    nameFilter = "",
    approvalStatus = "approved",
  } = params;

  // 1. Fetch current user info
  const userResponse = await directusFetch(
    `/items/user/${userId}?fields=user_id,user_fname,user_lname,user_mname,user_department,isAdmin,role,user_email,user_position`
  );
  const currentUser: User = userResponse.data;
  const isHRAdmin =
    currentUser?.isAdmin === 1 ||
    currentUser?.isAdmin === true ||
    currentUser?.role === "ADMIN" ||
    currentUser?.user_department === 2;

  // 2. Fetch all departments
  const deptResponse = await directusFetch(
    `/items/department?limit=-1&fields=department_id,department_name`
  ).catch(() => ({ data: [] }));
  const departments: Department[] = deptResponse.data || [];
  const deptsMap = new Map<number, Department>(
    departments.map((d) => [d.department_id, d])
  );

  // 3. Department authorization logic
  let assignedDepartmentIds: number[] = [];
  if (!isHRAdmin) {
    const taApproversRes = await directusFetch(
      `/items/ta_draft_approvers?filter[approver_id][_eq]=${userId}&filter[is_deleted][_eq]=0&fields=department_id`
    ).catch(() => ({ data: [] }));

    const taApprovers = taApproversRes.data || [];
    assignedDepartmentIds = taApprovers
      .map((ta: { department_id: number }) => ta.department_id)
      .filter(Boolean);

    if (
      currentUser?.user_department &&
      !assignedDepartmentIds.includes(currentUser.user_department)
    ) {
      assignedDepartmentIds.push(currentUser.user_department);
    }
  }

  // Helpers to identify active employees in Directus (supporting boolean, number, bit, buffer)
  const isDeletedUser = (val: unknown): boolean => {
    if (typeof val === "boolean") return val;
    if (typeof val === "number") return val !== 0;
    if (typeof val === "string") return val === "1" || val.toLowerCase() === "true";
    if (val && typeof val === "object") {
      const buf = val as { type?: string; data?: number[] };
      if (buf.type === "Buffer" && Array.isArray(buf.data)) {
        return buf.data[0] === 1;
      }
    }
    return false;
  };

  const isEmployeeUser = (val: unknown): boolean => {
    if (typeof val === "boolean") return val;
    if (typeof val === "number") return val === 1;
    if (typeof val === "string") return val === "1" || val.toLowerCase() === "true";
    if (val && typeof val === "object") {
      const buf = val as { type?: string; data?: number[] };
      if (buf.type === "Buffer" && Array.isArray(buf.data)) {
        return buf.data[0] === 1;
      }
    }
    return false;
  };

  // 4. Fetch users with employee and deleted flags
  const usersResponse = await directusFetch(
    `/items/user?limit=-1&fields=user_id,user_fname,user_lname,user_mname,user_department,biometric_id,user_position,is_employee,is_deleted`
  ).catch(() => ({ data: [] }));

  interface RawUser {
    user_id: number;
    user_fname: string;
    user_lname: string;
    user_mname: string | null;
    user_department: number | null;
    biometric_id?: string | null;
    user_position?: string;
    is_employee?: unknown;
    is_deleted?: unknown;
  }

  const fetchedUsers: RawUser[] = usersResponse.data || [];

  // Filter strictly to ACTIVE EMPLOYEES only
  const allUsers: RawUser[] = fetchedUsers.filter(
    (u) => !isDeletedUser(u.is_deleted) && isEmployeeUser(u.is_employee)
  );

  const usersMap = new Map<number, RawUser>(
    allUsers.map((u) => [u.user_id, u])
  );

  // Filter eligible users
  let eligibleUsers = allUsers;
  if (departmentId && departmentId !== "all") {
    eligibleUsers = eligibleUsers.filter(
      (u) => String(u.user_department) === String(departmentId)
    );
  } else if (!isHRAdmin) {
    if (assignedDepartmentIds.length > 0) {
      const allowedSet = new Set(assignedDepartmentIds.map(String));
      eligibleUsers = eligibleUsers.filter(
        (u) => u.user_department && allowedSet.has(String(u.user_department))
      );
    } else {
      eligibleUsers = [];
    }
  }

  const eligibleUserIds = eligibleUsers.map((u) => u.user_id);
  const employeeNames = Array.from(
    new Set(
      eligibleUsers.map((u) =>
        `${u.user_fname} ${u.user_mname ? u.user_mname + " " : ""}${u.user_lname}`.trim()
      )
    )
  ).sort();

  if (eligibleUserIds.length === 0 && !isHRAdmin) {
    const emptyMatrix: DepartmentMatrixData = {
      dates: [],
      employees: [],
      departmentTotals: {},
    };
    return {
      data: [],
      matrix: emptyMatrix,
      summary: {
        totalWorkMinutes: 0,
        totalLateMinutes: 0,
        totalUndertimeMinutes: 0,
        totalOvertimeMinutes: 0,
        totalDays: 0,
        uniqueEmployees: 0,
      },
      departments,
      currentUser,
      employeeNames: [],
      isHRAdmin,
      pagination: { currentPage: page, pageSize, totalItems: 0, totalPages: 0 },
    };
  }

  // 5. Build lean query filters for attendance_approval and attendance_log
  const approvalFilterParts: string[] = [];
  const logFilterParts: string[] = [];

  if (approvalStatus && approvalStatus !== "all") {
    approvalFilterParts.push(`filter[status][_eq]=${approvalStatus}`);
  }

  if (dateFrom) {
    approvalFilterParts.push(`filter[date_schedule][_gte]=${dateFrom}`);
    logFilterParts.push(`filter[log_date][_gte]=${dateFrom}`);
  }
  if (dateTo) {
    approvalFilterParts.push(`filter[date_schedule][_lte]=${dateTo}`);
    logFilterParts.push(`filter[log_date][_lte]=${dateTo}`);
  }

  if (departmentId && departmentId !== "all") {
    logFilterParts.push(`filter[department_id][_eq]=${departmentId}`);
    if (eligibleUserIds.length > 0) {
      approvalFilterParts.push(`filter[employee_id][_in]=${eligibleUserIds.join(",")}`);
    } else {
      approvalFilterParts.push(`filter[employee_id][_in]=-1`);
    }
  } else if (!isHRAdmin) {
    if (assignedDepartmentIds.length > 0) {
      logFilterParts.push(`filter[department_id][_in]=${assignedDepartmentIds.join(",")}`);
      if (eligibleUserIds.length > 0) {
        approvalFilterParts.push(`filter[employee_id][_in]=${eligibleUserIds.join(",")}`);
      }
    } else {
      logFilterParts.push(`filter[department_id][_in]=-1`);
      approvalFilterParts.push(`filter[employee_id][_in]=-1`);
    }
  }

  const approvalFields =
    "approval_id,employee_id,date_schedule,approved_by,approved_at,work_minutes,late_minutes,undertime_minutes,overtime_minutes,remarks,status";
  const logFields = "user_id,log_date,time_in,time_out";

  const approvalQuery = `?${approvalFilterParts.join("&")}${
    approvalFilterParts.length > 0 ? "&" : ""
  }fields=${approvalFields}&limit=-1`;

  const logQuery = `?${logFilterParts.join("&")}${
    logFilterParts.length > 0 ? "&" : ""
  }fields=${logFields}&limit=-1`;

  // 6. Fast parallel fetch: ONLY attendance_approval and attendance_log
  const [approvalsRes, logsRes] = await Promise.all([
    directusFetch(`/items/attendance_approval${approvalQuery}`).catch(() => ({ data: [] })),
    directusFetch(`/items/attendance_log${logQuery}`).catch(() => ({ data: [] })),
  ]);

  interface RawApproval {
    approval_id: number;
    employee_id: number;
    date_schedule: string;
    approved_by: number;
    approved_at: string;
    work_minutes: number;
    late_minutes: number;
    undertime_minutes: number;
    overtime_minutes: number;
    remarks: string | null;
    status: "approved" | "rejected" | "pending";
  }

  interface RawLog {
    user_id: number;
    log_date: string;
    time_in: string | null;
    time_out: string | null;
  }

  const rawApprovals: RawApproval[] = approvalsRes.data || [];
  const rawLogs: RawLog[] = logsRes.data || [];

  // Index logs by `${user_id}_${date}` in O(1) Map
  const logsByKey = new Map<string, RawLog>();
  for (const log of rawLogs) {
    if (log.log_date && log.user_id) {
      const cleanDate = log.log_date.split("T")[0];
      logsByKey.set(`${log.user_id}_${cleanDate}`, log);
    }
  }

  // Index approvals by `${employee_id}_${date}`
  const approvalsByKey = new Map<string, RawApproval>();
  const allRecords: TotalHoursRecord[] = [];

  for (const approval of rawApprovals) {
    const cleanDate = approval.date_schedule ? approval.date_schedule.split("T")[0] : "";
    if (!cleanDate || !approval.employee_id) continue;

    const empId = Number(approval.employee_id);
    const key = `${empId}_${cleanDate}`;
    approvalsByKey.set(key, approval);

    const user = usersMap.get(empId);
    if (!user) continue;

    if (
      departmentId &&
      departmentId !== "all" &&
      String(user.user_department) !== String(departmentId)
    ) {
      continue;
    }
    if (!isHRAdmin && assignedDepartmentIds.length > 0) {
      if (
        !user.user_department ||
        !assignedDepartmentIds.includes(user.user_department)
      ) {
        continue;
      }
    }

    const log = logsByKey.get(key);
    const deptId = user.user_department || 0;
    const dept = deptsMap.get(deptId);

    const work_minutes = Number(approval.work_minutes ?? 0);
    const late_minutes = Number(approval.late_minutes ?? 0);
    const undertime_minutes = Number(approval.undertime_minutes ?? 0);
    const overtime_minutes = Number(approval.overtime_minutes ?? 0);

    const parsedDate = parseISO(cleanDate);
    const dayOfWeek = !isNaN(parsedDate.getTime())
      ? format(parsedDate, "EEEE")
      : "N/A";

    const approverUser = approval.approved_by
      ? usersMap.get(approval.approved_by)
      : null;
    const approverName = approverUser
      ? `${approverUser.user_fname} ${approverUser.user_lname}`.trim()
      : null;

    allRecords.push({
      id: key,
      log_id: null,
      approval_id: approval.approval_id,
      employee_id: empId,
      employee_name: `${user.user_fname} ${
        user.user_mname ? user.user_mname + " " : ""
      }${user.user_lname}`.trim(),
      employee_position: user.user_position || dept?.department_name || "Staff",
      employee_code: user.biometric_id || null,
      department_id: deptId,
      department_name: dept?.department_name || "General",
      log_date: cleanDate,
      day_of_week: dayOfWeek,

      // Strictly from attendance_approval:
      work_minutes,
      late_minutes,
      undertime_minutes,
      overtime_minutes,
      approval_status: approval.status || "approved",
      remarks: approval.remarks || null,
      approved_by: approval.approved_by,
      approved_by_name: approverName,
      approved_at: approval.approved_at,

      // Actual biometric punches (from attendance_log):
      time_in: log?.time_in ?? null,
      time_out: log?.time_out ?? null,
      attendance_status: work_minutes > 0 ? "Present" : "Absent",
    });
  }

  // 7. Filtering in-memory for search & nameFilter
  let filtered = allRecords;

  if (nameFilter) {
    filtered = filtered.filter((r) =>
      r.employee_name.toLowerCase().includes(nameFilter.toLowerCase())
    );
  }

  if (search.trim()) {
    const s = search.trim().toLowerCase();
    filtered = filtered.filter(
      (r) =>
        r.employee_name.toLowerCase().includes(s) ||
        r.department_name.toLowerCase().includes(s) ||
        (r.employee_code && r.employee_code.toLowerCase().includes(s)) ||
        r.log_date.includes(s) ||
        (r.remarks && r.remarks.toLowerCase().includes(s))
    );
  }

  filtered.sort((a, b) => {
    if (a.log_date !== b.log_date) {
      return b.log_date.localeCompare(a.log_date);
    }
    return a.employee_name.localeCompare(b.employee_name);
  });

  // 8. KPI Summary
  const uniqueEmployeeSet = new Set<number>();
  let totalWorkMinutes = 0;
  let totalLateMinutes = 0;
  let totalUndertimeMinutes = 0;
  let totalOvertimeMinutes = 0;

  for (const record of filtered) {
    uniqueEmployeeSet.add(record.employee_id);
    totalWorkMinutes += record.work_minutes;
    totalLateMinutes += record.late_minutes;
    totalUndertimeMinutes += record.undertime_minutes;
    totalOvertimeMinutes += record.overtime_minutes;
  }

  const summary: TotalHoursSummary = {
    totalWorkMinutes,
    totalLateMinutes,
    totalUndertimeMinutes,
    totalOvertimeMinutes,
    totalDays: filtered.length,
    uniqueEmployees: uniqueEmployeeSet.size,
  };

  // 9. Build Department Summary Matrix (blazing fast O(N) mapping)
  let matrixDateStrings: string[] = [];
  if (dateFrom && dateTo) {
    matrixDateStrings = getDatesInRange(dateFrom, dateTo);
  } else {
    const distinctDates = Array.from(new Set(allRecords.map((r) => r.log_date))).sort();
    if (distinctDates.length > 0) {
      matrixDateStrings = distinctDates.slice(-14);
    } else {
      const today = new Date();
      matrixDateStrings = [format(today, "yyyy-MM-dd")];
    }
  }

  const matrixDates = matrixDateStrings.map((dStr) => {
    const p = parseISO(dStr);
    return {
      date: dStr,
      displayHeader: !isNaN(p.getTime()) ? format(p, "MMM d (EEE)") : dStr,
      dayOfWeek: !isNaN(p.getTime()) ? format(p, "EEE") : "",
    };
  });

  let matrixUsers = eligibleUsers;
  if (nameFilter) {
    matrixUsers = matrixUsers.filter((u) => {
      const fullName = `${u.user_fname} ${u.user_mname ? u.user_mname + " " : ""}${u.user_lname}`.trim();
      return fullName.toLowerCase().includes(nameFilter.toLowerCase());
    });
  }
  if (search.trim()) {
    const s = search.trim().toLowerCase();
    matrixUsers = matrixUsers.filter((u) => {
      const fullName = `${u.user_fname} ${u.user_mname ? u.user_mname + " " : ""}${u.user_lname}`.trim().toLowerCase();
      const pos = (u.user_position || "").toLowerCase();
      return fullName.includes(s) || pos.includes(s) || String(u.user_id).includes(s);
    });
  }

  matrixUsers.sort((a, b) => a.user_fname.localeCompare(b.user_fname));

  const departmentTotals: DepartmentMatrixData["departmentTotals"] = {};
  for (const md of matrixDates) {
    departmentTotals[md.date] = {
      work_minutes: 0,
      late_minutes: 0,
      overtime_minutes: 0,
      undertime_minutes: 0,
      present_count: 0,
      absent_count: 0,
    };
  }

  const matrixEmployees: MatrixEmployeeRow[] = matrixUsers.map((emp) => {
    const fullName = `${emp.user_fname} ${emp.user_mname ? emp.user_mname + " " : ""}${emp.user_lname}`.trim();
    const dept = emp.user_department ? deptsMap.get(emp.user_department) : null;
    const deptName = dept?.department_name || "Department";
    const position = emp.user_position || deptName;

    const daysMap: Record<string, MatrixDayData> = {};
    let empTotalWork = 0;
    let empTotalLate = 0;
    let empTotalOT = 0;
    let empTotalUT = 0;
    let empDaysAttended = 0;
    let empDaysAbsent = 0;

    for (const md of matrixDates) {
      const key = `${emp.user_id}_${md.date}`;
      const app = approvalsByKey.get(key);
      const log = logsByKey.get(key);

      const isApproved = app?.status === "approved";
      const isAbsent = !isApproved || (app.work_minutes === 0 && (!app.remarks || app.remarks.toLowerCase().includes("absent")));

      if (isAbsent) {
        empDaysAbsent++;
        if (departmentTotals[md.date]) {
          departmentTotals[md.date].absent_count++;
        }

        daysMap[md.date] = {
          date: md.date,
          isAbsent: true,
          status: "Absent",
          work_minutes: app?.work_minutes || 0,
          late_minutes: app?.late_minutes || 0,
          overtime_minutes: app?.overtime_minutes || 0,
          undertime_minutes: app?.undertime_minutes || 0,
          work_formatted: "A",
          late_formatted: "A",
          overtime_formatted: "A",
          undertime_formatted: "A",
          time_in: log?.time_in || null,
          time_out: log?.time_out || null,
          time_in_formatted: formatClockTime(log?.time_in),
          time_out_formatted: formatClockTime(log?.time_out),
          remarks: app?.remarks || "Absent",
        };
      } else {
        empDaysAttended++;
        empTotalWork += app.work_minutes;
        empTotalLate += app.late_minutes;
        empTotalOT += app.overtime_minutes;
        empTotalUT += app.undertime_minutes;

        if (departmentTotals[md.date]) {
          departmentTotals[md.date].present_count++;
          departmentTotals[md.date].work_minutes += app.work_minutes;
          departmentTotals[md.date].late_minutes += app.late_minutes;
          departmentTotals[md.date].overtime_minutes += app.overtime_minutes;
          departmentTotals[md.date].undertime_minutes += app.undertime_minutes;
        }

        daysMap[md.date] = {
          date: md.date,
          isAbsent: false,
          status: "Approved",
          work_minutes: app.work_minutes,
          late_minutes: app.late_minutes,
          overtime_minutes: app.overtime_minutes,
          undertime_minutes: app.undertime_minutes,
          work_formatted: formatHM(app.work_minutes),
          late_formatted: formatHM(app.late_minutes),
          overtime_formatted: formatHM(app.overtime_minutes),
          undertime_formatted: formatHM(app.undertime_minutes),
          time_in: log?.time_in || null,
          time_out: log?.time_out || null,
          time_in_formatted: formatClockTime(log?.time_in),
          time_out_formatted: formatClockTime(log?.time_out),
          remarks: app.remarks,
        };
      }
    }

    return {
      user_id: emp.user_id,
      employee_name: fullName,
      employee_position: position,
      department_id: emp.user_department || 0,
      department_name: deptName,
      days: daysMap,
      totals: {
        total_work_minutes: empTotalWork,
        total_late_minutes: empTotalLate,
        total_overtime_minutes: empTotalOT,
        total_undertime_minutes: empTotalUT,
        total_days_attended: empDaysAttended,
        total_days_absent: empDaysAbsent,
      },
    };
  });

  const matrix: DepartmentMatrixData = {
    dates: matrixDates,
    employees: matrixEmployees,
    departmentTotals,
  };

  const totalItems = filtered.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const startIndex = (page - 1) * pageSize;
  const paginatedData = filtered.slice(startIndex, startIndex + pageSize);

  const pagination: PaginationState = {
    currentPage: page,
    pageSize,
    totalItems,
    totalPages,
  };

  return {
    data: paginatedData,
    matrix,
    summary,
    departments,
    currentUser,
    employeeNames,
    isHRAdmin,
    pagination,
  };
}
