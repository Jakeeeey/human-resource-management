// Type definitions for attendance approval module based on DDL

export interface AttendanceLog {
  log_id: number;
  user_id: number;
  department_id: number;
  log_date: string;
  time_in: string | null;
  lunch_start: string | null;
  lunch_end: string | null;
  break_start: string | null;
  break_end: string | null;
  time_out: string | null;
  status: 'On Time' | 'Late' | 'Absent' | 'Half Day' | 'Incomplete' | 'Leave' | 'Holiday' | null;
  approval_status: 'pending' | 'approved' | 'rejected' | null;
  created_at: string;
  updated_at: string;
}

export interface AttendanceLogWithUser extends AttendanceLog {
  user_fname: string;
  user_lname: string;
  user_mname: string | null;
  department_name: string | null;
  work_minutes: number;
  late_minutes: number;
  undertime_minutes: number;
  overtime_minutes: number;
  sched_time_in: string | null;
  sched_time_out: string | null;
}

export interface AttendanceApproval {
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
  status: 'approved' | 'rejected';
}

export interface ApprovalAction {
  log_id: number; // The log being approved/rejected
  employee_id: number; // The user owning the log
  date_schedule: string;
  status: 'approved' | 'rejected' | 'pending';
  remarks: string;
  // Minutes fields can be calculated on backend or passed if available
  work_minutes?: number;
  late_minutes?: number;
  undertime_minutes?: number;
  overtime_minutes?: number;
}

export interface AttendanceListResponse {
  data: AttendanceLogWithUser[];
  total: number;
}
