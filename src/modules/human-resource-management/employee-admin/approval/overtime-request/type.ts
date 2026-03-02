// Type definitions for overtime request approval

export interface OvertimeRequest {
  overtime_id: number;
  user_id: number;
  department_id: number | null;
  log_id: number | null;
  request_date: string;
  sched_timeout: string;
  ot_from: string;
  ot_to: string;
  duration_minutes: number;
  purpose: string;
  remarks: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  approver_id: number | null;
  approved_at: string | null;
  filed_at: string;
}

export interface OvertimeRequestWithUser extends OvertimeRequest {
  user_fname: string;
  user_lname: string;
  user_mname: string | null;
  department_name: string | null;
}

export interface ApprovalAction {
  overtime_id: number;
  status: 'approved' | 'rejected';
  remarks: string;
  approver_id: number;
}

export interface OvertimeListResponse {
  data: OvertimeRequestWithUser[];
  total: number;
}
