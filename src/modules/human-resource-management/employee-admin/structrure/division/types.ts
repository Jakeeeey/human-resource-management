/**
 * Division Module - Type Definitions
 * Includes User, Division, Department, and junction table types
 */

// ============================================================================
// DIRECTUS ENTITY TYPES
// ============================================================================

export interface User {
    user_id: number;
    user_fname: string;
    user_lname: string;
    user_mname?: string | null;
    user_email?: string;
}

export interface Division {
    division_id: number;
    division_name: string;
    division_description: string | null;
    division_head: string | null; // Legacy field - ignore
    division_code: string | null;
    date_added: string;
    division_head_id: number | null; // FK to user.user_id
}

export interface Department {
    department_id: number;
    department_name: string;
    parent_division?: number;
}

export interface DepartmentPerDivision {
    id: number;
    division_id: number;
    department_id: number;
    bank_id: number | null;
}

// ============================================================================
// ENRICHED TYPES (WITH JOINS)
// ============================================================================

export interface DepartmentWithBank extends Department {
    bank_id: number | null;
}

export interface DivisionWithRelations extends Omit<Division, "division_head"> {
    division_head_user?: User | null; // Joined user
    departments?: DepartmentWithBank[]; // Joined departments via junction
    department_count?: number; // Count of departments
}

// ============================================================================
// FILTER TYPES
// ============================================================================

export interface DivisionFilters {
    search: string; // Division name or code search
    dateRange: {
        from: Date | null;
        to: Date | null;
    };
}

// ============================================================================
// FORM TYPES (For CRUD)
// ============================================================================

export interface DepartmentAssignment {
    department_id: number;
    bank_id: number | null;
}

export interface DivisionFormData {
    division_name: string;
    division_code: string;
    division_head_id: number; // User ID
    division_description: string;
    department_assignments: DepartmentAssignment[]; // Array of department assignments
}

export type CreateDivisionData = DivisionFormData;

export interface UpdateDivisionData extends Partial<DivisionFormData> {
    division_id: number;
}

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

export interface BankAccount {
    bank_id: number;
    bank_name: string;
    account_number: string;
    bank_description: string;
    branch: string;
    is_active: boolean;
}

export interface DivisionsAPIResponse {
    divisions: DivisionWithRelations[];
    users: User[];
    departments: Department[];
    bank_accounts: BankAccount[];
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

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get full name from user object
 */
export function getUserFullName(user: User | null | undefined): string {
    if (!user) return "Not assigned";

    const parts = [user.user_fname, user.user_mname, user.user_lname]
        .filter(Boolean);
    return parts.join(" ");
}

/**
 * Format department list for display
 */
export function formatDepartmentList(departments: Department[] | undefined): string {
    if (!departments || departments.length === 0) {
        return "No departments";
    }

    const count = departments.length;
    const names = departments.slice(0, 3).map(d => d.department_name).join(", ");

    if (count <= 3) {
        return `${names} (${count})`;
    }

    return `${names} +${count - 3} more (${count})`;
}

// ===============================
// Directus Generic Responses
// ===============================
export interface DirectusListResponse<T> {
    data: T[];
}

export interface DirectusSingleResponse<T> {
    data: T;
}