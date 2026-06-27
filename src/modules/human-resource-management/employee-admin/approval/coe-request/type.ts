export interface COERequest {
  id: number;
  employee_id: number;
  purpose: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  request_date: string;
  approved_by: number | null;
  approval_date: string | null;
  ecopy_file_url: string | null;
  hr_remarks: string | null;
  updated_at: string;
}

export interface COERequestWithUser extends COERequest {
  user_fname: string;
  user_lname: string;
  user_mname: string | null;
  department_name: string | null;
}

export interface ApprovalAction {
  coe_id: number;
  status: "APPROVED" | "REJECTED";
  remarks: string;
  approver_id: number;
}

export interface COEListResponse {
  data: COERequestWithUser[];
  total: number;
}
