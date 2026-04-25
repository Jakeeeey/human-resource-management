export type RequestStatus = 'pending' | 'approved' | 'rejected' | 'returned' | 'cancelled';
export type RequestType = 'leave' | 'overtime' | 'undertime';

export interface UserDetails {
  user_id: number;
  user_fname: string;
  user_lname: string;
  user_position?: string;
  user_department?: {
    department_name: string;
  } | null;
}

export interface Department {
  department_id: number;
  department_name: string;
}

export interface HistoryLog {
  history_id: number;
  status_after: RequestStatus;
  remarks: string | null;
  created_at: string;
  approver_id: {
    user_fname: string;
    user_lname: string;
    user_position: string;
  };
}

export interface ApprovalLogEntry {
  history_id: number;
  request_id: number;
  request_type: RequestType;
  status_after: RequestStatus;
  remarks: string | null;
  created_at: string;
  requester: UserDetails | null;
  current_status: RequestStatus | null;
  request_details: Record<string, unknown> | null;
  approver_id?: {
    user_fname: string;
    user_lname: string;
  } | null;
}

export interface TAApprovalHistory {
  history_id: number;
  request_id: number;
  request_type: RequestType;
  approver_id: number;
  status_after: RequestStatus;
  remarks: string | null;
  created_at: string;
}

export interface TAApproverMapping {
  id: number;
  approver_id: number;
  department_id: number;
  level: number;
  is_deleted?: boolean;
}

export interface BaseRequest {
  user_id: number | UserDetails;
  department_id: number | { id: number; department_name: string } | null;
  department_name?: string; // Manually resolved name
  status: RequestStatus;
  current_approval_level: number;
  approver_id: number | null;
  approved_at: string | null;
  filed_at: string;
  remarks: string | null;
  attachment_uuid?: string;
  total_levels?: number; // Added for progress display
  module_type?: RequestType; // Added for unified rendering
  assigned_level?: number; // Approver's level for this request
}

export interface LeaveRequest extends BaseRequest {
  leave_id: number;
  leave_type: 'vacation' | 'sick' | 'emergency' | 'special' | 'unpaid' | 'others';
  leave_start: string | null;
  leave_end: string | null;
  total_days: number;
  reason: string | null;
  attatchment_uuid?: string; // Typo in DDL
}

export interface OvertimeRequest extends BaseRequest {
  overtime_id: number;
  log_id: number | null;
  request_date: string;
  sched_timeout: string;
  ot_from: string;
  ot_to: string;
  duration_minutes: number;
  purpose: string;
}

export interface UndertimeRequest extends BaseRequest {
  undertime_id: number;
  log_id: number | null;
  request_date: string;
  sched_timeout: string;
  actual_timeout: string;
  duration_minutes: number;
  reason: string;
}

export type AnyTARequest = LeaveRequest | OvertimeRequest | UndertimeRequest;

export interface TAFilterOptions {
  status?: RequestStatus | 'all';
  types?: RequestType[];
  startDate?: string;
  endDate?: string;
  departmentId?: number;
}

export interface TAActionPayload {
  requestId: number;
  type: RequestType;
  action: 'approve' | 'reject' | 'return' | 'override' | 'approve_override' | 'reject_override';
  remarks: string;
  isOverride?: boolean;
  attachment_uuid?: string;
}
