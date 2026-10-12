export type CscLeaveTypeCode =
  | "vacation"
  | "mandatory_forced"
  | "sick"
  | "maternity"
  | "paternity"
  | "special_privilege"
  | "solo_parent"
  | "study"
  | "vawc"
  | "rehabilitation"
  | "special_women"
  | "special_emergency"
  | "adoption"
  | "others";

export interface CscLeaveTypeConfig {
  code: CscLeaveTypeCode;
  title: string;
  legalBasis: string;
  category: "Regular" | "Medical" | "Parental" | "Special";
  defaultDays?: number;
}

export const CSC_LEAVE_TYPES: CscLeaveTypeConfig[] = [
  {
    code: "vacation",
    title: "Vacation Leave",
    legalBasis: "Sec. 51, Rule XVI, Omnibus Rules Implementing E.O. No. 292",
    category: "Regular",
  },
  {
    code: "mandatory_forced",
    title: "Mandatory / Forced Leave",
    legalBasis: "Sec. 25, Rule XVI, Omnibus Rules Implementing E.O. No. 292",
    category: "Regular",
    defaultDays: 5,
  },
  {
    code: "sick",
    title: "Sick Leave",
    legalBasis: "Sec. 43, Rule XVI, Omnibus Rules Implementing E.O. No. 292",
    category: "Medical",
  },
  {
    code: "maternity",
    title: "Maternity Leave (105 Days)",
    legalBasis: "R.A. No. 11210 / IRR issued by CSC, DOLE and SSS",
    category: "Parental",
    defaultDays: 105,
  },
  {
    code: "paternity",
    title: "Paternity Leave (7 Days)",
    legalBasis: "R.A. No. 8187 / CSC MC No. 71, s. 1998, as amended",
    category: "Parental",
    defaultDays: 7,
  },
  {
    code: "special_privilege",
    title: "Special Privilege Leave (3 Days)",
    legalBasis: "Sec. 21, Rule XVI, Omnibus Rules Implementing E.O. No. 292",
    category: "Special",
    defaultDays: 3,
  },
  {
    code: "solo_parent",
    title: "Solo Parent Leave (7 Days)",
    legalBasis: "R.A. No. 8972 / CSC MC No. 8, s. 2004",
    category: "Parental",
    defaultDays: 7,
  },
  {
    code: "study",
    title: "Study Leave (up to 6 Mos)",
    legalBasis: "Sec. 68, Rule XVI, Omnibus Rules Implementing E.O. No. 292",
    category: "Special",
  },
  {
    code: "vawc",
    title: "10-Day VAWC Leave",
    legalBasis: "R.A. No. 9262 / CSC MC No. 15, s. 2005",
    category: "Special",
    defaultDays: 10,
  },
  {
    code: "rehabilitation",
    title: "Rehabilitation Privilege",
    legalBasis: "Sec. 55, Rule XVI, Omnibus Rules Implementing E.O. No. 292",
    category: "Medical",
  },
  {
    code: "special_women",
    title: "Special Leave Benefits for Women",
    legalBasis: "R.A. No. 9710 / CSC MC No. 25, s. 2010",
    category: "Special",
  },
  {
    code: "special_emergency",
    title: "Special Emergency (Calamity) Leave",
    legalBasis: "CSC MC No. 2, s. 2012, as amended",
    category: "Special",
  },
  {
    code: "adoption",
    title: "Adoption Leave",
    legalBasis: "R.A. No. 8552",
    category: "Parental",
  },
  {
    code: "others",
    title: "Others",
    legalBasis: "Custom leave benefits / Collective Negotiation Agreement",
    category: "Special",
  },
];

export type LguLeaveStatus =
  | "pending"
  | "recommended"
  | "approved"
  | "disapproved"
  | "cancelled";

export interface LguLeaveRequest {
  id: number;
  user_id: number;
  department_id: number;
  office_department: string;
  last_name: string;
  first_name: string;
  middle_name?: string | null;
  date_of_filing: string;
  position: string;
  monthly_salary: number;
  leave_type: CscLeaveTypeCode;
  leave_type_others?: string | null;

  // Conditional details (Section 6.B)
  vacation_location?: "within_philippines" | "abroad" | null;
  vacation_location_abroad?: string | null;
  sick_location?: "in_hospital" | "out_patient" | null;
  sick_illness_specify?: string | null;
  women_illness_specify?: string | null;
  study_purpose?: "masters_degree" | "bar_board_review" | null;
  other_purpose?: string | null;

  // Section 6.C & 6.D
  working_days_applied: number;
  start_date: string;
  end_date: string;
  commutation_requested: boolean;

  // Approval Lifecycle & Hierarchy
  status: LguLeaveStatus;
  current_approval_level: number;
  total_levels?: number;
  assigned_level?: number;
  can_approve?: boolean;

  // Section 7.A - HR Credit Certification
  credits_as_of?: string | null;
  vl_total_earned?: number | null;
  vl_less_applied?: number | null;
  vl_balance?: number | null;
  sl_total_earned?: number | null;
  sl_less_applied?: number | null;
  sl_balance?: number | null;
  certified_by_name?: string | null;
  certified_by_id?: number | null;

  // Section 7.B - Supervisor Recommendation
  recommendation?: "for_approval" | "for_disapproval" | null;
  recommendation_reason?: string | null;
  recommended_by_name?: string | null;
  recommended_by_id?: number | null;

  // Section 7.C & 7.D - Final Action (Head of Agency / Mayor)
  approved_days_with_pay?: number | null;
  approved_days_without_pay?: number | null;
  disapproved_due_to?: string | null;
  action_officer_name?: string | null;
  action_officer_id?: number | null;
  action_date?: string | null;

  created_at?: string;
  updated_at?: string;
}

export interface ApprovalHistoryEntry {
  id: number;
  request_id: number;
  approver_id: number;
  approver_name: string;
  approver_position?: string;
  approver_department?: string;
  level: number;
  action_type: "certify" | "recommend" | "approve" | "disapprove";
  status_after: LguLeaveStatus;
  remarks?: string | null;
  created_at: string;
}

export interface CertifyCreditsPayload {
  request_id: number;
  credits_as_of: string;
  vl_total_earned: number;
  vl_less_applied: number;
  vl_balance: number;
  sl_total_earned: number;
  sl_less_applied: number;
  sl_balance: number;
  certified_by_name: string;
}

export interface RecommendPayload {
  request_id: number;
  recommendation: "for_approval" | "for_disapproval";
  recommendation_reason?: string;
  recommended_by_name: string;
}

export interface FinalActionPayload {
  request_id: number;
  action: "approve" | "disapprove";
  approved_days_with_pay?: number;
  approved_days_without_pay?: number;
  disapproved_due_to?: string;
  action_officer_name: string;
  action_date: string;
}

export type LguLeaveActionPayload =
  | { type: "certify"; payload: CertifyCreditsPayload }
  | { type: "recommend"; payload: RecommendPayload }
  | { type: "final_action"; payload: FinalActionPayload }
  | { type: "advance_level"; request_id: number; remarks?: string };

export interface LguLeaveListResponse {
  data: LguLeaveRequest[];
  total: number;
  userRole?: {
    userId: number;
    userName: string;
    isAdmin: boolean;
    isHRHead: boolean;
    assignedDepartments: number[];
  };
}

export interface LguLeaveFilterParams {
  status?: string;
  departmentId?: string;
  leaveType?: string;
  search?: string;
  startDate?: string;
  endDate?: string;
}
