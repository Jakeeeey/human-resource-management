export interface COERequest {
  id: number;
  employee_id: number;
  purpose: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "RELEASED";
  request_date: string;
  approved_by: number | null;
  approval_date: string | null;
  ecopy_file_url: string | null;
  remarks: string | null;
  hr_remarks: string | null;
  updated_at: string;
}

export interface COERequestWithUser extends COERequest {
  user_fname: string;
  user_lname: string;
  user_mname: string | null;
  department_name: string | null;
  view_file_url: string | null;
  ecopy_file_name: string | null;
  ecopy_file_type: string | null;
}

export interface ApprovalAction {
  coe_id: number;
  status: "APPROVED" | "REJECTED" | "RELEASED";
  remarks: string;
  approver_id: number;
  ecopy_file_url?: string;
}

export interface COEListResponse {
  data: COERequestWithUser[];
  total: number;
}
