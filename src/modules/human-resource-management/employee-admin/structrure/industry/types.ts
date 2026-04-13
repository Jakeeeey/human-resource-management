/**
 * Industry Module - Type Definitions
 */

// ============================================================================
// DIRECTUS ENTITY TYPES
// ============================================================================

export interface Industry {
    id: number;
    industry_name: string;
    industry_description: string | null;
    industry_head: string | null;
    industry_code: string | null;
    date_added: string | null;
    tax_id: number | null;
}

// ============================================================================
// ENRICHED TYPES (WITH JOINS)
// ============================================================================

export type IndustryWithRelations = Industry;

// ============================================================================
// FILTER TYPES
// ============================================================================

export interface IndustryFilters {
    search: string;
}

// ============================================================================
// FORM TYPES (For CRUD)
// ============================================================================

export interface IndustryFormData {
    industry_name: string;
    industry_description: string;
    industry_head: string;
    industry_code: string;
    date_added?: string | null;
    tax_id?: number | string | null;
}

export type CreateIndustryData = IndustryFormData;

export interface UpdateIndustryData extends Partial<IndustryFormData> {
    id: number;
}

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

export interface IndustriesAPIResponse {
    industries: IndustryWithRelations[];
    metadata: {
        total: number;
        lastUpdated: string;
    };
}
