import { z } from "zod";

export const LGU_HIERARCHY_LEVELS = [
  {
    level: 1,
    title: "Level 1: Recommending Officer",
    subtitle: "Immediate Supervisor / Department Head",
    section: "Section 7.B",
    description: "Evaluates application merits and recommends approval or disapproval.",
    badgeColor: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-400/30",
    roleName: "Supervisor / Recommending Officer",
  },
  {
    level: 2,
    title: "Level 2: Credit Certification",
    subtitle: "HRMO Officer / HR Head",
    section: "Section 7.A",
    description: "Certifies leave credit balances (VL/SL earned, deducted, and balance).",
    badgeColor: "bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-400/30",
    roleName: "HRMO Certifying Officer",
  },
  {
    level: 3,
    title: "Level 3: Head of Agency",
    subtitle: "Hon. Municipal Mayor / Local Chief Executive",
    section: "Section 7.C & 7.D",
    description: "Executive final action: Officially approves or disapproves the application.",
    badgeColor: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-400/30",
    roleName: "Local Chief Executive / Mayor",
  },
] as const;

export type LguHierarchyLevelNumber = 1 | 2 | 3;

export const createApproverSchema = z.object({
  department_id: z.coerce.number().min(1, "Please select a department"),
  approver_id: z.coerce.number().min(1, "Please select an employee / approver"),
  level: z.coerce.number().min(1).max(3, "Level must be between 1 and 3"),
});

export const updateApproverSchema = z.object({
  id: z.number(),
  department_id: z.coerce.number().min(1, "Please select a department").optional(),
  approver_id: z.coerce.number().min(1, "Please select an employee / approver").optional(),
  level: z.coerce.number().min(1).max(3, "Level must be between 1 and 3").optional(),
  is_deleted: z.coerce.number().optional(),
});

export type CreateApproverInput = z.infer<typeof createApproverSchema>;
export type UpdateApproverInput = z.infer<typeof updateApproverSchema>;

export interface DepartmentInfo {
  department_id: number;
  department_name: string;
  department_head?: string | null;
  department_head_id?: number | null;
}

export interface UserInfo {
  user_id: number;
  user_fname: string;
  user_mname?: string | null;
  user_lname: string;
  user_email: string;
  user_position: string;
  user_department?: number | null;
  department_name?: string | null;
}

export interface LguLeaveApprover {
  id: number;
  approver_id: number;
  department_id: number;
  level: number;
  is_deleted: number;
  created_at?: string;
  updated_at?: string;
  created_by?: number;
  updated_by?: number;

  // Enriched relational attributes
  approver_name: string;
  approver_email: string;
  approver_position: string;
  department_name: string;
}

export interface HierarchyPipelineStage {
  level: number;
  title: string;
  subtitle: string;
  section: string;
  roleName: string;
  approvers: LguLeaveApprover[];
}

export interface LguLeaveHierarchyFilterParams {
  departmentId?: string;
  level?: string;
  search?: string;
}

export interface LguLeaveHierarchyResponse {
  data: LguLeaveApprover[];
  departments: DepartmentInfo[];
  users: UserInfo[];
  total: number;
}

export const setupDepartmentHierarchySchema = z.object({
  department_id: z.coerce.number().min(1, "Please select a department"),
  level1_approver_id: z.coerce.number().nullable().optional(),
  level2_approver_id: z.coerce.number().nullable().optional(),
  level3_approver_id: z.coerce.number().nullable().optional(),
});

export type SetupDepartmentHierarchyInput = z.infer<typeof setupDepartmentHierarchySchema>;

export const batchApplyStandardApproversSchema = z.object({
  target_department_ids: z.array(z.coerce.number()).min(1, "Select at least one department"),
  level2_approver_id: z.coerce.number().nullable().optional(),
  level3_approver_id: z.coerce.number().nullable().optional(),
});

export type BatchApplyStandardApproversInput = z.infer<typeof batchApplyStandardApproversSchema>;

export interface DepartmentHierarchySummary {
  department: DepartmentInfo;
  level1Approver?: LguLeaveApprover | null;
  level2Approver?: LguLeaveApprover | null;
  level3Approver?: LguLeaveApprover | null;
  status: "complete" | "partial" | "empty";
  configuredLevelsCount: number;
}

