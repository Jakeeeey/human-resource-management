export interface TopsheetRequest {
  overtime_id: number;
  user_id: number;
  department_id?: number;
  department_name?: string | null;
  status: string;
  request_date: string;
  ot_from: string;
  ot_to: string;
  duration_minutes: number;
  purpose: string;
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
  total_duration_minutes: number;
  requests: TopsheetRequest[];
}

export interface TopsheetDataResponse {
  data: TopsheetUserSummary[];
  total: number;
  departments: { department_id: number; department_name: string }[];
  currentUser: Record<string, unknown> | null;
}
