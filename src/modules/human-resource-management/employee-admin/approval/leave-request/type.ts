// Type definitions for leave request approval

export interface LeaveRequest {
  leave_id: number;
  user_id: number;
  department_id: number | null;
  leave_type: string;
  leave_start: string;
  leave_end: string;
  total_days: string;
  reason: string;
  remarks: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  approver_id: number | null;
  approved_at: string | null;
  filed_at: string;
}

export interface LeaveRequestWithUser extends LeaveRequest {
  user_fname: string;
  user_lname: string;
  user_mname: string | null;
  department_name: string | null;
}

export interface ApprovalAction {
  leave_id: number;
  status: 'approved' | 'rejected';
  remarks: string;
  approver_id: number;
}

export interface LeaveListResponse {
  data: LeaveRequestWithUser[];
  total: number;
}
