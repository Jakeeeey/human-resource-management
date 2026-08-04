export interface TopsheetRequest {
  leave_request_id: number;
  user_id: number;
  department_id?: number;
  department_name?: string | null;
  status: string;
  leave_start: string;
  leave_end: string;
  total_days: string | number;
  reason: string;
  filed_at: string;
  remarks?: string;
  user_fname: string;
  user_mname: string | null;
  user_lname: string;
  employee_name: string;
}

export interface TopsheetUserSummary {
  user_id: number;
  employee_name: string;
  department_name: string | null;
  total_leave_days: number;
  requests: TopsheetRequest[];
}

export interface TopsheetDataResponse {
  data: TopsheetUserSummary[];
  total: number;
  departments: { department_id: number; department_name: string }[];
  currentUser: Record<string, unknown> | null;
}
