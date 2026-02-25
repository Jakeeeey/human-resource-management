// ============================================================================
// Employee File Record List — Type Definitions
// ============================================================================

import type { EmployeeFileRecordType } from "../employee-file-record-type/types";

export interface EmployeeFileRecordList {
    id: number;
    record_type_id: number;
    name: string;
    description: string | null;
    created_at: string;
    created_by: number | null;
    updated_at: string;
    updated_by: number | null;
}

export interface EmployeeFileRecordListWithRelations extends EmployeeFileRecordList {
    record_type: EmployeeFileRecordType | null;
}

// ============================================================================
// FILTER TYPES
// ============================================================================

export interface EmployeeFileRecordListFilters {
    search: string;
    recordTypeId: number | null;
    dateRange: {
        from: Date | null;
        to: Date | null;
    };
}

// ============================================================================
// FORM TYPES
// ============================================================================

export interface EmployeeFileRecordListFormData {
    record_type_id: number;
    name: string;
    description: string;
}
