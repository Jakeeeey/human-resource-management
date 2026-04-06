/**
 * Operation Module - Type Definitions
 */

// ============================================================================
// DIRECTUS ENTITY TYPES
// ============================================================================

export interface Operation {
    id: number;
    operation_code: string | null;
    operation_name: string | null;
    created_at: string;
    date_modified: string | null;
    encoder_id: number | null;
    company_id: number | null;
    type: number | null;
    definition: string | null;
}

// ============================================================================
// ENRICHED TYPES (WITH JOINS)
// ============================================================================

export type OperationWithRelations = Operation;

// ============================================================================
// FILTER TYPES
// ============================================================================

export interface OperationFilters {
    search: string;
}

// ============================================================================
// FORM TYPES (For CRUD)
// ============================================================================

export interface OperationFormData {
    operation_code: string;
    operation_name: string;
    type: number | string | null;
    definition: string;
}

export type CreateOperationData = OperationFormData;

export interface UpdateOperationData extends Partial<OperationFormData> {
    id: number;
}

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

export interface OperationTableProps {
    data: OperationWithRelations[];
    isLoading?: boolean;
    onUpdate: (id: number, data: OperationFormData) => Promise<void>;
}

export interface OperationsAPIResponse {
    operations: OperationWithRelations[];
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

export interface DirectusSingleResponse<T> {
    data: T;
}
