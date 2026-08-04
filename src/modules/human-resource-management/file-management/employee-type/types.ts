// ============================================================================
// Employee Type - Type Definitions
// ============================================================================

export interface EmployeeType {
    id: number;
    type_name: string;
    description: string | null;
}

// ============================================================================
// FILTER TYPES
// ============================================================================

export interface EmployeeTypeFilters {
    search: string;
    type_name: string;
}

// ============================================================================
// FORM TYPES
// ============================================================================

export interface EmployeeTypeFormData {
    type_name: string;
    description: string;
}
