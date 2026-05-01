// ============================================================================
// Employment Status Registration - Type Definitions
// ============================================================================

export interface EmploymentStatus {
    id: number;
    name: string;
    description: string | null;
    created_at: string;
    created_by: number | string | Record<string, unknown> | null;
    updated_at: string;
    updated_by: number | string | Record<string, unknown> | null;
}

// ============================================================================
// FILTER TYPES
// ============================================================================

export interface EmploymentStatusFilters {
    search: string;
    name: string;
    dateRange: {
        from: Date | null;
        to: Date | null;
    };
}

// ============================================================================
// FORM TYPES
// ============================================================================

export interface EmploymentStatusFormData {
    name: string;
    description: string;
}
