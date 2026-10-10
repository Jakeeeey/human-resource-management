# Specification: Overtime (OT) & Undertime (UT) Request Badges & Approval Integration

This document defines the specification and implementation standards for displaying, badge-styling, and calculating **Overtime Requests (`overtime_request`)** and **Undertime Requests (`undertime_request`)** within Attendance Approval modules (Daily & Cutoff).

---

## 1. Overview & Business Objectives

When employees render overtime or leave early (undertime), they submit requests (`overtime_request` / `undertime_request`) with a specified duration and purpose/reason. During attendance approval:

1. **Immediate Visual Indicators (Badges)**:
   - Approvers must see explicit **OT Badges** and **UT Badges** indicating whether a request exists for that date and what its approval status is:
     - `Pending`: Amber / Warning (`OT: Pending (120m)`, `UT: Pending (60m)`)
     - `Approved`: Green / Success (`OT: Approved (120m)`, `UT: Approved (60m)`)
     - `Rejected`: Red / Danger (`OT: Rejected (120m)`, `UT: Rejected (60m)`)
   - Tooltips on badges reveal the employee's justification (`purpose` for OT, `reason` for UT).
2. **Overtime Auto-Crediting Rules**:
   - If an OT request is **Pending** or **Rejected** (or absent), the system **must not** automatically credit overtime minutes into approval records (`overtime_minutes = 0`). Approvers can still manually override minutes if desired.
   - If the OT request is **Approved**, the system automatically calculates overtime minutes based on actual clock-out time past scheduled shift departure (`excessOut = actualOut - schedOut`), capped at the approved request duration (`duration_minutes`).
3. **Undertime Request Status Indicator**:
   - Clearly flags whether the employee's early departure was authorized with a filed undertime request, showing its status and duration.
4. **Summary Table Pending Alerts**:
   - The Cutoff Employee Summary Table displays pending counters (`X Pending OT`, `X Pending UT`) under the employee name to alert approvers before batch approval.

---

## 2. Database Schema

### 2.1 Overtime Request (`overtime_request`)

| Field | Type | Description |
| :--- | :--- | :--- |
| `overtime_id` | `INT / PK` | Primary key of the overtime request |
| `user_id` | `INT` | Employee user ID |
| `department_id` | `INT` | Department ID |
| `request_date` | `DATE` | Calendar date of requested overtime (`YYYY-MM-DD`) |
| `sched_timeout` | `TIME / DATETIME` | Scheduled shift departure time |
| `ot_from` | `TIME / DATETIME` | Overtime start time |
| `ot_to` | `TIME / DATETIME` | Overtime end time |
| `duration_minutes` | `INT` | Requested overtime length in minutes |
| `purpose` | `TEXT` | Reason/justification for overtime work |
| `status` | `VARCHAR` | `'pending'` \| `'approved'` \| `'rejected'` \| `'cancelled'` |

### 2.2 Undertime Request (`undertime_request`)

| Field | Type | Description |
| :--- | :--- | :--- |
| `undertime_id` | `INT / PK` | Primary key of the undertime request |
| `user_id` | `INT` | Employee user ID |
| `department_id` | `INT` | Department ID |
| `request_date` | `DATE` | Calendar date of requested undertime (`YYYY-MM-DD`) |
| `sched_timeout` | `TIME / DATETIME` | Scheduled shift departure time |
| `actual_timeout` | `TIME / DATETIME` | Actual early clock-out time |
| `duration_minutes` | `INT` | Requested undertime length in minutes |
| `reason` | `TEXT` | Reason/justification for leaving early |
| `status` | `VARCHAR` | `'pending'` \| `'approved'` \| `'rejected'` \| `'cancelled'` |

---

## 3. Backend Implementation (`route.ts`)

### 3.1 Fetching All Request States

Query both collections for the relevant users and date range (without restricting to `approved` only):

```typescript
let otFilter = userIdsFilter;
let utFilter = userIdsFilter;
if (isDailyApproval) {
  otFilter = `${userIdsFilter ? userIdsFilter + "&" : ""}filter[request_date][_eq]=${targetDate}`;
  utFilter = `${userIdsFilter ? userIdsFilter + "&" : ""}filter[request_date][_eq]=${targetDate}`;
} else if (startDate && endDate) {
  otFilter = `${userIdsFilter ? userIdsFilter + "&" : ""}filter[request_date][_gte]=${startDate}&filter[request_date][_lte]=${endDate}`;
  utFilter = `${userIdsFilter ? userIdsFilter + "&" : ""}filter[request_date][_gte]=${startDate}&filter[request_date][_lte]=${endDate}`;
}

const [otRequestsRes, utRequestsRes] = await Promise.all([
  directusFetch(`/items/overtime_request?${otFilter}&limit=1000&fields=overtime_id,user_id,request_date,status,duration_minutes,purpose,ot_from,ot_to`).catch(() => ({ data: [] })),
  directusFetch(`/items/undertime_request?${utFilter}&limit=1000&fields=undertime_id,user_id,request_date,status,duration_minutes,reason,remarks`).catch(() => ({ data: [] })),
]);
```

### 3.2 Overtime Calculation Logic

```typescript
const dayKey = log.log_date.split('T')[0];
const otReq = otRequestsMap.get(`${log.user_id}_${dayKey}`);
const isOtApproved = otReq && String(otReq.status || "").toLowerCase() === "approved";

if (actualOut > schedOut && isOtApproved) {
  const excessOut = Math.floor((actualOut.getTime() - schedOut.getTime()) / 60000);
  let otDurationCap = Number(otReq.duration_minutes ?? 0);
  if (otDurationCap <= 0 && otReq.ot_from && otReq.ot_to) {
    const otStart = timeToDate(log.log_date, otReq.ot_from);
    let otEnd = timeToDate(log.log_date, otReq.ot_to);
    if (otEnd < otStart) {
      otEnd = new Date(otEnd.getTime() + 24 * 60 * 60 * 1000);
    }
    otDurationCap = Math.floor((otEnd.getTime() - otStart.getTime()) / 60000);
  }

  overtime_minutes = otDurationCap > 0 ? Math.min(excessOut, otDurationCap) : excessOut;
} else {
  overtime_minutes = 0;
}
```

### 3.3 Returning Structured Objects

Attach `ot_request` and `ut_request` payloads onto each attendance log:

```typescript
const ot_request = logOtReq ? {
  id: logOtReq.overtime_id,
  status: logOtReq.status,
  duration_minutes: logOtReq.duration_minutes ?? null,
  purpose: logOtReq.purpose ?? null,
  ot_from: logOtReq.ot_from ?? null,
  ot_to: logOtReq.ot_to ?? null,
} : null;

const ut_request = logUtReq ? {
  id: logUtReq.undertime_id,
  status: logUtReq.status,
  duration_minutes: logUtReq.duration_minutes ?? null,
  reason: logUtReq.reason || logUtReq.remarks || null,
} : null;
```

---

## 4. Frontend Presentation (`AttendanceTable.tsx`)

Rendered in the employee details cell and column inputs:

```tsx
{(log.ot_request || log.ut_request) && (
  <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
    {log.ot_request && (
      <span
        className={cn(
          "inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold tracking-tight border transition-all cursor-help",
          log.ot_request.status.toLowerCase() === "approved"
            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
            : log.ot_request.status.toLowerCase() === "pending"
            ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30"
            : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30"
        )}
        title={log.ot_request.purpose ? `OT Purpose: ${log.ot_request.purpose}` : `OT Status: ${log.ot_request.status}`}
      >
        OT: {capitalize(log.ot_request.status)}
        {log.ot_request.duration_minutes ? ` (${log.ot_request.duration_minutes}m)` : ""}
      </span>
    )}
    {log.ut_request && (
      <span
        className={cn(
          "inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold tracking-tight border transition-all cursor-help",
          log.ut_request.status.toLowerCase() === "approved"
            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
            : log.ut_request.status.toLowerCase() === "pending"
            ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30"
            : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30"
        )}
        title={log.ut_request.reason ? `UT Reason: ${log.ut_request.reason}` : `UT Status: ${log.ut_request.status}`}
      >
        UT: {capitalize(log.ut_request.status)}
        {log.ut_request.duration_minutes ? ` (${log.ut_request.duration_minutes}m)` : ""}
      </span>
    )}
  </div>
)}
```

---

## 5. Verification Checklist

1. `npm run typecheck` (tsc validation passes).
2. `npx eslint . --max-warnings=0` (clean linting).
3. `npm run build` (production build compiles).
