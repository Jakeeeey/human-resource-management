// ============================================================================
// Employee File Record Type — Type Definitions
// ============================================================================

export interface EmployeeFileRecordType {
    id: number;
    name: string;
    description: string | null;
    created_at: string;
    created_by: number | null;
    updated_at: string;
    updated_by: number | null;
}

// ============================================================================
// FILTER TYPES
// ============================================================================

export interface EmployeeFileRecordTypeFilters {
    search: string;
    dateRange: {
        from: Date | null;
        to: Date | null;
    };
}

// ============================================================================
// FORM TYPES
// ============================================================================

export interface EmployeeFileRecordTypeFormData {
    name: string;
    description: string;
}
