// Type definitions for undertime request approval

export interface UndertimeRequest {
  undertime_id: number;
  user_id: number;
  department_id: number | null;
  log_id: number | null;
  request_date: string;
  sched_timeout: string;
  actual_timeout: string;
  duration_minutes: number;
  reason: string;
  remarks: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  approver_id: number | null;
  approved_at: string | null;
  filed_at: string;
  created_by: number | null;
  updated_at: string | null;
  updated_by: number | null;
}

export interface UndertimeRequestWithUser extends UndertimeRequest {
  user_fname: string;
  user_lname: string;
  user_mname: string | null;
  department_name: string | null;
}

export interface ApprovalAction {
  undertime_id: number;
  status: 'approved' | 'rejected';
  remarks: string;
  approver_id: number;
}

export interface UndertimeListResponse {
  data: UndertimeRequestWithUser[];
  total: number;
}
