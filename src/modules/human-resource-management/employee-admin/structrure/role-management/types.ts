export interface SystemUser {
    user_id: number;
    user_fname: string;
    user_mname?: string;
    user_lname: string;
    user_email: string;
    user_position: string;
    [key: string]: unknown;
}

export interface Division {
    division_id: number;
    division_name: string;
    division_code: string;
}

export interface Department {
    department_id: number;
    department_name: string;
    department_code?: string;
}

export interface Salesman {
    id: number;
    salesman_name: string;
    salesman_code: string;
}

export interface Executive {
    id: number;
    user_id: number | SystemUser;
    created_at: string;
    created_by?: number;
    is_deleted?: number;
}

export interface DivisionSalesHead {
    id: number;
    division_id: number | Division;
    user_id: number | SystemUser;
    created_at: string;
    is_deleted?: number;
}

export interface SupervisorPerDivision {
    id: number;
    division_id: number | Division;
    supervisor_id: number | SystemUser;
    created_at: string;
    is_deleted?: number;
}

export interface SalesmanPerSupervisor {
    id: number;
    supervisor_per_division_id: number | SupervisorPerDivision;
    salesman_id: number | Salesman;
    created_at: string;
    is_deleted?: number;
}

export interface ReviewCommittee {
    id: number;
    approver_id: number | SystemUser;
    is_deleted?: number;
    created_by?: number;
    created_at?: string;
}

export interface ExpenseReviewCommittee {
    id: number;
    approver_id: number | SystemUser;
    division_id: number | Division;
    approver_heirarchy: number;
    is_deleted?: number;
    created_by?: number;
    created_at?: string;
}

export interface TAApprover {
    id: number;
    department_id: number | Department;
    approver_id: number | SystemUser;
    level: number;
    is_deleted?: number;
    created_at?: string;
    created_by?: number;
    updated_at?: string;
    updated_by?: number;
}

export type RoleManagementCategory = "hierarchy" | "committee";

export type RoleManagementTab =
    | "executive"
    | "review-committee"
    | "expense-review-committee"
    | "division-head"
    | "supervisor"
    | "salesman"
    | "ta-committee";
