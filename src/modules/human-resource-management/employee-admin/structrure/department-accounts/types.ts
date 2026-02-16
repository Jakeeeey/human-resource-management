/**
 * Department Accounts Module - Type Definitions
 * Includes Division, Department, Chart of Accounts, and junction table types
 */

// ============================================================================
// DIRECTUS ENTITY TYPES
// ============================================================================

export interface Division {
    division_id: number;
    division_name: string;
    division_code: string | null;
    division_description?: string | null;
    division_head_id?: number | null;
    date_added?: string;
}

export interface Department {
    department_id: number;
    department_name: string;
    parent_division?: number;
    department_description?: string | null;
}

export interface DepartmentPerDivision {
    id: number;
    division_id: number;
    department_id: number;
    bank_id: number | null;
    department?: Department; // Enriched with department data
}

export interface AccountType {
    id: number;
    account_name: string;
    description: string | null;
}

export interface ChartOfAccount {
    coa_id: number;
    gl_code: string | null;
    account_title: string | null;
    bsis_code: number | null;
    account_type: number | null;
    balance_type: number | null;
    description: string | null;
    memo_type: number | null;
    date_added: string | null;
    added_by: number | null;
    isPayment: boolean;
    is_payment: boolean | null;
    account_type_info?: AccountType | null; // Enriched with account type data
}

export interface DepartmentDivisionCOA {
    id: number;
    dept_div_id: number;
    coa_id: number;
}

// ============================================================================
// ENRICHED TYPES (WITH JOINS)
// ============================================================================

export interface DivisionWithDepartments extends Division {
    department_per_divisions: DepartmentPerDivision[];
}

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

export interface DepartmentAccountsAPIResponse {
    divisions: DivisionWithDepartments[];
    departments: Department[];
    department_per_divisions: DepartmentPerDivision[];
    accounts: ChartOfAccount[];
    account_types: AccountType[];
    metadata: {
        total_divisions: number;
        total_departments: number;
        total_accounts: number;
        lastUpdated: string;
    };
}

export interface AssignedAccountsResponse {
    assigned: ChartOfAccount[];
    available: ChartOfAccount[];
}

// ============================================================================
// FORM/MUTATION TYPES
// ============================================================================

export interface AssignAccountsPayload {
    dept_div_id: number;
    coa_ids: number[];
}

export interface UnassignAccountPayload {
    dept_div_id: number;
    coa_id: number;
}

// ============================================================================
// UI STATE TYPES
// ============================================================================

export interface DepartmentAccountsState {
    selectedDivisionId: number | null;
    selectedDeptDivId: number | null;
    searchAssigned: string;
    searchAvailable: string;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Format account display name
 */
export function formatAccountDisplay(account: ChartOfAccount): string {
    const glCode = account.gl_code || "N/A";
    const title = account.account_title || "Untitled";
    return `${glCode} - ${title}`;
}

/**
 * Filter accounts by search query
 */
export function filterAccountsBySearch(
    accounts: ChartOfAccount[],
    searchQuery: string
): ChartOfAccount[] {
    if (!searchQuery.trim()) return accounts;

    const query = searchQuery.toLowerCase();
    return accounts.filter(
        (acc) =>
            acc.gl_code?.toLowerCase().includes(query) ||
            acc.account_title?.toLowerCase().includes(query) ||
            acc.account_type_info?.account_name?.toLowerCase().includes(query)
    );
}

/**
 * Get departments for a specific division
 */
export function getDepartmentsForDivision(
    division: DivisionWithDepartments | undefined
): DepartmentPerDivision[] {
    return division?.department_per_divisions || [];
}
