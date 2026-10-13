import type { AttendanceLogWithUser } from "../type";

/**
 * Parses time string (e.g. "17:00:00" or "17:00") into a Date object on the specified date string.
 */
export function timeToDate(dateStr: string, timeStr: string): Date {
  const datePart = dateStr.includes("T") ? dateStr.split("T")[0] : dateStr.split(" ")[0];
  const [y, mm, d] = datePart.split("-").map(Number);
  const [h, m, s] = timeStr.split(":").map(Number);
  return new Date(y, (mm || 1) - 1, d || 1, h || 0, m || 0, Math.floor(s || 0));
}

/**
 * Parses an ISO or standard datetime string into a local Date object.
 */
export function parseLocalISO(isoStr: string): Date {
  if (!isoStr) return new Date();
  
  if (!isoStr.includes("T")) {
    if (isoStr.includes(" ")) {
      const [datePart, timePart] = isoStr.split(" ");
      const [y, mm, d] = datePart.split("-").map(Number);
      const [h, m, s] = timePart.split(":").map(Number);
      return new Date(y, (mm || 1) - 1, d || 1, h || 0, m || 0, Math.floor(s || 0));
    }
    return new Date(isoStr);
  }

  const [datePart, timePart] = isoStr.split("T");
  const [y, mm, d] = datePart.split("-").map(Number);
  const [h, m, s] = timePart.replace("Z", "").split(":").map(Number);
  return new Date(y, (mm || 1) - 1, d || 1, h || 0, m || 0, Math.floor(s || 0));
}

/**
 * Extracts total requested overtime duration in minutes from an attendance log.
 * Returns 0 if no OT request or if request was rejected / cancelled.
 */
export function getLogRequestedOtMinutes(log: AttendanceLogWithUser): number {
  if (!log.ot_request) return 0;
  
  const status = (log.ot_request.status || "").toLowerCase();
  if (status === "rejected" || status === "cancelled") return 0;

  if (log.ot_request.duration_minutes != null && Number(log.ot_request.duration_minutes) > 0) {
    return Number(log.ot_request.duration_minutes);
  }

  if (log.ot_request.ot_from && log.ot_request.ot_to && log.log_date) {
    try {
      const otStart = timeToDate(log.log_date, log.ot_request.ot_from);
      let otEnd = timeToDate(log.log_date, log.ot_request.ot_to);
      if (otEnd < otStart) {
        otEnd = new Date(otEnd.getTime() + 24 * 60 * 60 * 1000);
      }
      const diff = Math.floor((otEnd.getTime() - otStart.getTime()) / 60000);
      return diff > 0 ? diff : 0;
    } catch {
      return 0;
    }
  }

  return 0;
}

/**
 * Computes approved/credited overtime based on the computation of the actual time out
 * and the requested overtime duration/range.
 *
 * Rules:
 * 1. Must have an OT request (not rejected or cancelled).
 * 2. Must have an actual time out.
 * 3. Overtime starts at ot_from (or sched_time_out if ot_from not specified).
 * 4. Actual overtime worked is the duration from OT start to actual time out.
 * 5. Credited overtime is capped by the requested overtime (cannot exceed requested OT).
 * 6. If the employee punched out early before OT start, 0 is credited.
 */
export function computeLogOvertimeMinutes(log: AttendanceLogWithUser): number {
  if (!log.ot_request) {
    return 0;
  }

  const otStatus = (log.ot_request.status || "").toLowerCase();
  if (otStatus === "rejected" || otStatus === "cancelled") {
    return 0;
  }

  // 1. Requested duration
  const requestedMins = getLogRequestedOtMinutes(log);
  if (requestedMins <= 0) {
    return 0;
  }

  // 2. Must have actual time out
  if (!log.time_out || !log.log_date) {
    return 0;
  }

  try {
    const actualOut = parseLocalISO(log.time_out);

    // 3. Determine overtime start time
    let otStart: Date;
    if (log.ot_request.ot_from) {
      otStart = timeToDate(log.log_date, log.ot_request.ot_from);
    } else if (log.sched_time_out) {
      otStart = timeToDate(log.log_date, log.sched_time_out);
    } else if (log.time_in) {
      const actualIn = parseLocalISO(log.time_in);
      otStart = new Date(actualIn.getTime() + 9 * 60 * 60000); // 8hrs work + 1hr break
    } else {
      return 0;
    }

    // Handle midnight crossing for actualOut
    if (log.time_in) {
      const actualIn = parseLocalISO(log.time_in);
      if (actualOut < actualIn) {
        actualOut.setTime(actualOut.getTime() + 24 * 60 * 60 * 1000);
      }
    } else if (actualOut < otStart) {
      const diffHours = (otStart.getTime() - actualOut.getTime()) / 3600000;
      if (diffHours > 12) {
        actualOut.setTime(actualOut.getTime() + 24 * 60 * 60 * 1000);
      }
    }

    // If actual time out is at or before overtime start, 0 overtime
    if (actualOut <= otStart) {
      return 0;
    }

    const actualWorkedOtMins = Math.floor((actualOut.getTime() - otStart.getTime()) / 60000);

    // Credited overtime is the actual worked overtime capped by the requested overtime
    return Math.max(0, Math.min(requestedMins, actualWorkedOtMins));
  } catch {
    return 0;
  }
}
