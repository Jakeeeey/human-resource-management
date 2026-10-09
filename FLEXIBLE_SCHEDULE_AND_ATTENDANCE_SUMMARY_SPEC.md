# Specification: Flexible Schedule Late Exemption, Missing Time-Out Undertime Penalty & Cutoff Attendance Days Calculation

This document serves as an end-to-end prompt and technical specification for an AI agent to implement or replicate three core HR Attendance features across any similar management system:
1. **Flexible Schedule Exemption from Department Lateness (`is_flexible_schedule`)**
2. **Configurable Missing Time-Out Undertime Penalty (`payroll_no_time_out_undertime_amount`) & Undertime Balancing**
3. **Accurate Attended Days Count in Cutoff Summaries (`days_count`)**

---

## Part 1: Flexible Schedule Exemption from Department Lateness

### 1.1 Business Requirements
- Employees flagged with `is_flexible_schedule = 1` (or `true`) must **not** be penalized for being late when their working hours follow a standard **Department Schedule**.
- Specifically:
  - `late_minutes` must be set to `0`.
  - Punctuality/Status must resolve to `"On Time"` rather than `"Late"`.
  - Missing time-out penalty / undertime balancing calculations must remain intact (using `late_minutes = 0`).
- **Exception**: If an employee is scheduled under a specific **On-Call Schedule** (`is_oncall = true` / `source = "oncall"`), their punctuality must still be checked against their on-call start time (they are **not** exempt from on-call lateness).

---

### 1.2 Database Schema
Add a boolean/tinyint column to the `user` table:

```sql
ALTER TABLE `user` ADD COLUMN `is_flexible_schedule` tinyint(1) DEFAULT '0' AFTER `is_department_head`;
```

---

### 1.3 Value Parsing Helper (MySQL / Directus Resilient)
Directus and MySQL may return `tinyint(1)` fields as boolean `true`/`false`, integer `1`/`0`, string `"1"`/`"true"`, or raw Buffer `{ type: "Buffer", data: [1] }`. Use this helper across backend routes:

```typescript
export function isFlexibleScheduleUser(val: unknown): boolean {
  if (typeof val === "boolean") return val;
  if (typeof val === "number") return val !== 0;
  if (val === "1" || val === "true") return true;
  if (val && typeof val === "object") {
    const buf = val as { type?: string; data?: number[] };
    if (buf.type === "Buffer" && Array.isArray(buf.data)) {
      return buf.data[0] === 1;
    }
  }
  return false;
}
```

---

### 1.4 Backend Calculation Logic (Attendance Approval API)

#### Step 1: Query the Column
Include `is_flexible_schedule` whenever querying the `user` collection:
```typescript
const usersResponse = await directusFetch(
  `/items/user?limit=-1&fields=user_id,user_fname,user_lname,user_mname,user_department,is_employee,is_deleted,is_flexible_schedule`
);
```

#### Step 2: Track Schedule Source
Ensure the schedule resolution helper identifies whether the schedule originates from an **on-call** assignment or the fallback **department** schedule:

```typescript
interface Sched {
  time_in: string;
  time_out: string;
  grace_period: number;
  source: "oncall" | "department";
}

const getEmployeeSchedule = (userId: number, deptId: number | null, logDate: string): Sched | null => {
  // 1. Check On-Call schedule first
  const oncallSched = findActiveOncallSchedule(userId, logDate);
  if (oncallSched) {
    return {
      time_in: oncallSched.work_start,
      time_out: oncallSched.work_end,
      grace_period: Number(oncallSched.grace_period ?? 5),
      source: "oncall",
    };
  }

  // 2. Fall back to Department schedule
  const deptSched = findDepartmentSchedule(deptId);
  if (deptSched) {
    return {
      time_in: deptSched.work_start,
      time_out: deptSched.work_end,
      grace_period: Number(deptSched.grace_period ?? 5),
      source: "department",
    };
  }

  return null;
};
```

#### Step 3: Apply Exemption in Late Calculation
```typescript
const isFlexible = isFlexibleScheduleUser(user?.is_flexible_schedule);
const isExemptFromLate = isFlexible && schedule?.source === "department";

let work_minutes = 0;
let late_minutes = 0;
let undertime_minutes = 0;
let overtime_minutes = 0;

if (log.time_in && schedule) {
  const actualIn = parseLocalISO(log.time_in);
  const schedIn = timeToDate(log.log_date, schedule.time_in);
  const schedOut = timeToDate(log.log_date, schedule.time_out);

  if (actualIn > schedOut) {
    // Clocked in past scheduled time-out:
    // If exempt, late is 0; otherwise capped to 240 (half day)
    late_minutes = isExemptFromLate ? 0 : 240;
    work_minutes = 480;

    // Undertime & missing time-out logic (see Part 2)...
  } else {
    // Normal clock-in calculation:
    const diffInMs = actualIn.getTime() - schedIn.getTime();
    const diffInMins = Math.floor(diffInMs / 60000);

    if (!isExemptFromLate && diffInMins > schedule.grace_period) {
      late_minutes = diffInMins;
    } else {
      late_minutes = 0;
    }
    work_minutes = 480;
  }
}

// Adjust status if exempt from department lateness
let computedStatus = manualAdjustments?.remarks || log.status || (log.time_in ? "On Time" : "Absent");
if (isExemptFromLate && computedStatus === "Late" && !manualAdjustments?.remarks) {
  computedStatus = "On Time";
}
```

---

### 1.5 Workforce Attendance Reports & Client Hooks
Apply the same rule across all attendance reporting endpoints and calculation hooks:
1. **Department Report Route**:
   ```typescript
   const isFlexible = isFlexibleScheduleUser(user.is_flexible_schedule);
   const isExemptFromDeptLate = isFlexible && !oncallSched;
   const late = isExemptFromDeptLate ? 0 : calculateLate(timeIn, effectiveWorkStart, effectiveGrace);
   if (isExemptFromDeptLate && status === "Late") status = "On Time";
   const punctuality = !timeIn ? null : late > 0 ? "Late" : "On Time";
   ```
2. **Employee History Route**:
   ```typescript
   const isFlexible = isFlexibleScheduleUser(rawUser.is_flexible_schedule);
   enrichedLog.late = isFlexible ? 0 : calculateLate(log.time_in, schedFields.work_start, schedFields.grace_period);
   if (isFlexible && enrichedLog.status === "Late") enrichedLog.status = "On Time";
   ```
3. **Frontend Attendance Hooks (`useAttendance`, `useEmployeeReport`)**:
   Exempt employees from `derivePunctuality` / `computeLate` when `is_flexible_schedule === true` and `!is_oncall`.

---

## Part 2: Configurable Missing Time-Out Undertime Penalty & Undertime Balancing

### 2.1 Business Requirements
1. **Flexible Schedule Exemption**:
   - If an employee has `is_flexible_schedule = true` and is on a standard department schedule (`schedule.source === "department"`), they are **exempt from department undertime** as well:
     ```typescript
     undertime_minutes = 0;
     ```
2. **Overnight / Cross-Midnight Shifts**:
   - **Scheduled Shift**: If `schedOut < schedIn` (e.g. 10:00 PM to 06:00 AM), `schedOut` spans into the next day:
     ```typescript
     if (schedOut < schedIn) {
       schedOut = new Date(schedOut.getTime() + 24 * 60 * 60 * 1000);
     }
     ```
   - **Actual Punch**: If the employee clocked out at a time before their clock-in (e.g., clocked in at 06:53 PM and clocked out at 06:00 AM), `actualOut` is on the following calendar day:
     ```typescript
     if (actualOut < actualIn) {
       actualOut = new Date(actualOut.getTime() + 24 * 60 * 60 * 1000);
     }
     ```
   - Preventing this cross-midnight rollover bug avoids falsely calculating massive undertime (such as 660 minutes when 06:00 AM next day was mistakenly compared to 05:00 PM same day).
3. **Actual Undertime (With Time-Out)**:
   - When a non-exempt employee clocks out before the scheduled departure time (`actualOut < schedOut`):
     ```typescript
     undertime_minutes = Math.floor((schedOut.getTime() - actualOut.getTime()) / 60000);
     ```
   - If they clocked out at or after scheduled time-out, `undertime_minutes = 0`.
4. **Missing Time-Out (No Clock-Out)**:
   - By default, missing time-out applies a penalty of **240 minutes** (4 hours / half-day penalty).
   - The penalty must be configurable via the `general_setting` table using the key:
     `payroll_no_time_out_undertime_amount`
   - If this setting key is missing, null, or empty, the system defaults to **240 minutes**.
   - If the key exists (e.g., `'0'`, `'120'`, `'240'`), use that numeric value as the penalty.
5. **480-Minute Balancing Rule**:
   - Total penalties (`late_minutes + undertime_minutes`) must not exceed the standard full day of 480 minutes.
   - If `late_minutes + noTimeOutUndertimePenalty > 480`, cap undertime:
     ```typescript
     undertime_minutes = Math.max(0, 480 - late_minutes);
     ```
   - Otherwise:
     ```typescript
     undertime_minutes = noTimeOutUndertimePenalty;
     ```

---

### 2.2 Database Configuration Seed
Insert or update the general setting key:

```sql
INSERT INTO general_setting (setting_key, setting_value, created_at, updated_at)
VALUES ('payroll_no_time_out_undertime_amount', '0', NOW(), NOW())
ON DUPLICATE KEY UPDATE setting_value = '0', updated_at = NOW();
```

---

### 2.3 Backend Implementation (Route Handler)

#### Step 1: Query and Parse the General Setting
```typescript
const generalSettingRes = await directusFetch(
  `/items/general_setting?filter[setting_key][_eq]=payroll_no_time_out_undertime_amount&fields=setting_key,setting_value&limit=1`
).catch(() => ({ data: [] }));

// Default penalty is 240 if setting is missing/null/empty
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
```

#### Step 2: Undertime & Overnight Calculation Flow

```typescript
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
    // Clocked in past scheduled departure
    late_minutes = isExemptFromLate ? 0 : 240;
    work_minutes = 480;

    if (isExemptFromLate) {
      undertime_minutes = 0;
    } else if (actualOut) {
      undertime_minutes = actualOut < schedOut ? Math.floor((schedOut.getTime() - actualOut.getTime()) / 60000) : 0;
    } else {
      undertime_minutes = late_minutes + noTimeOutUndertimePenalty > 480
        ? Math.max(0, 480 - late_minutes)
        : noTimeOutUndertimePenalty;
    }
  } else {
    // Normal clock-in
    const diffInMs = actualIn.getTime() - schedIn.getTime();
    const diffInMins = Math.floor(diffInMs / 60000);
    late_minutes = !isExemptFromLate && diffInMins > schedule.grace_period ? diffInMins : 0;
    work_minutes = 480;

    if (actualOut) {
      if (isExemptFromLate) {
        undertime_minutes = 0;
      } else if (actualOut < schedOut) {
        undertime_minutes = Math.floor((schedOut.getTime() - actualOut.getTime()) / 60000);
      } else {
        undertime_minutes = 0;
      }
    } else {
      // Missing time-out penalty with 480-minute cap
      if (late_minutes + noTimeOutUndertimePenalty > 480) {
        undertime_minutes = Math.max(0, 480 - late_minutes);
      } else {
        undertime_minutes = noTimeOutUndertimePenalty;
      }
    }
  }
}
```

*Note: This balancing rule applies to both standard clock-in (`actualIn <= schedOut`) and late clock-in beyond scheduled departure (`actualIn > schedOut`).*

---

## Part 3: Cutoff Summary Attended Days Count (`days_count`)

### 3.1 Problem Statement
In attendance cutoff summaries, grouping records by employee previously incremented `existing.days_count += 1` for **every** record in the date range. Consequently, employees who were completely absent (`work_minutes: 0`, no punches) still displayed `"15 Days"` (or the total calendar days in the cutoff), misleading HR managers into believing the employee was present.

---

### 3.2 Business Requirements
- The **DAYS** summary column must reflect **the actual number of days the employee attended work** during the cutoff period.
- If an employee had zero attendance (e.g. absent for all 15 days), their summary must show **`0 Days`**.
- A day qualifies as an attended day if:
  1. The employee has a valid clock-in punch (`log.time_in`), **OR**
  2. The employee has a valid clock-out punch (`log.time_out`), **OR**
  3. The employee has positive work minutes (`log.work_minutes > 0`), **AND**
  4. The record is **not** an absent log (status does not indicate unworked absence).
- Days must be counted by **distinct calendar dates** (`Set<string>`) to avoid double-counting in case of multiple punches or split shifts on the same date.

---

### 3.3 Implementation Pattern (Cutoff Summary Aggregation)

In the cutoff component (e.g., `AttendanceApprovalCutoff.tsx`):

```typescript
const employeeSummaries = React.useMemo(() => {
  const summaryMap = new Map<number, EmployeeSummary & { attendedDates: Set<string> }>();

  filteredLogs.forEach((log) => {
    // 1. Identify if the log is an unworked absence
    const isAbsent =
      (!log.time_in && !log.time_out && (log.work_minutes || 0) === 0) ||
      (Boolean(log.status) && String(log.status).toLowerCase().includes("absent") && (log.work_minutes || 0) === 0);

    // 2. Determine if the log represents actual attendance
    const hasAttendance =
      !isAbsent &&
      Boolean(
        (log.time_in && String(log.time_in).trim() !== "") ||
        (log.time_out && String(log.time_out).trim() !== "") ||
        (log.work_minutes && log.work_minutes > 0)
      );

    const existing = summaryMap.get(log.user_id);
    if (existing) {
      existing.total_work_minutes += log.work_minutes || 0;
      existing.total_late_minutes += log.late_minutes || 0;
      existing.total_undertime_minutes += log.undertime_minutes || 0;
      existing.total_overtime_minutes += log.overtime_minutes || 0;

      if (hasAttendance) {
        const dateKey = log.log_date ? log.log_date.split("T")[0] : `${existing.attendedDates.size + 1}`;
        existing.attendedDates.add(dateKey);
        existing.days_count = existing.attendedDates.size;
      }
    } else {
      const attendedDates = new Set<string>();
      if (hasAttendance) {
        const dateKey = log.log_date ? log.log_date.split("T")[0] : "1";
        attendedDates.add(dateKey);
      }

      summaryMap.set(log.user_id, {
        user_id: log.user_id,
        user_fname: log.user_fname,
        user_lname: log.user_lname,
        department_name: log.department_name,
        total_work_minutes: log.work_minutes || 0,
        total_late_minutes: log.late_minutes || 0,
        total_undertime_minutes: log.undertime_minutes || 0,
        total_overtime_minutes: log.overtime_minutes || 0,
        days_count: attendedDates.size,
        attendedDates,
      });
    }
  });

  return Array.from(summaryMap.values());
}, [filteredLogs]);
```

---

### 3.4 UI Badge Formatting
In the summary table presentation component (e.g., `EmployeeSummaryTable.tsx`):

```tsx
<TableCell className="px-6 py-4 text-center">
  <Badge variant="outline" className="rounded-lg font-bold bg-background/50 border-muted/20">
    {summary.days_count} {summary.days_count === 1 ? "Day" : "Days"}
  </Badge>
</TableCell>
```

---

## Part 4: Verification & Quality Assurance (CI Gates)

Whenever applying this logic to another codebase, run the standard CI verification suite:

1. **Linting Verification**:
   ```bash
   npx eslint . --max-warnings=0
   ```
   *Expected outcome: 0 errors, 0 warnings.*

2. **TypeScript Compilation**:
   ```bash
   npm run typecheck
   # or: npx tsc --noEmit
   ```
   *Expected outcome: Exit code 0.*

3. **Production Build Verification**:
   ```bash
   npm run build
   ```
   *Expected outcome: All static and dynamic routes compile without type or runtime errors.*
