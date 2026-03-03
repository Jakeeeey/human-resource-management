/**
 * Department Module - Type Definitions
 * Updated with User relation for department_head
 */
// import {DepartmentPosition} from "@/modules/human-resource-management/employee-admin/structrure/department";

// ============================================================================
// DIRECTUS ENTITY TYPES
// ============================================================================

export interface User {
    user_id: number;
    user_fname: string;
    user_lname: string;
    user_mname?: string | null;
    user_email?: string;
    user_department?: number;
    is_deleted?: { data: number[] } | null;
}

export interface Department {
    department_id: number;
    department_name: string;
    parent_division: number;
    department_description: string;
    department_head: number | string | User | null;
    date_added: string;
}

export interface Division {
    division_id: number;
    division_name: string;
    division_description: string | null;
    division_code: string | null;
    date_added: string;
}

// ============================================================================
// ENRICHED TYPES (WITH JOINS)
// ============================================================================



export interface DepartmentWithRelations extends Department {
    division: Division | null;
    department_head_user: User | null;
    department_head_id: number | null;
    positions: DepartmentPosition[];
}

export interface DepartmentPosition {
    id: number;
    department_id: number;
    position: string;
}

// ============================================================================
// FILTER TYPES
// ============================================================================

export interface DepartmentFilters {
    search: string; // Department name search
    dateRange: {
        from: Date | null;
        to: Date | null;
    };
}

// ============================================================================
// FORM TYPES (For CRUD)
// ============================================================================

export interface DepartmentFormData {
    department_name: string;
    parent_division: number;
    department_description: string;
    department_head: number; // ✅ Changed from string to number
    date_added: string;
    positions: string[];
}

export type CreateDepartmentData = DepartmentFormData;

export interface UpdateDepartmentData extends Partial<DepartmentFormData> {
    department_id: number;
}

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

export interface DepartmentsAPIResponse {
    departments: DepartmentWithRelations[];
    divisions: Division[];
    users: User[];
    metadata: {
        total: number;
        lastUpdated: string;
    };
}

// ============================================================================
// DIRECTUS API TYPES
// ============================================================================

export interface DirectusResponse<T> {
    data: T[];
    meta?: {
        filter_count?: number;
        total_count?: number;
    };
}