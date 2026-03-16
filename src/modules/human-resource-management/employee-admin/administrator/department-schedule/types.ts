/**
 * Department Schedule Module - Type Definitions
 * Includes User, Department, and Schedule types
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

export interface Department {
    department_id: number;
    department_name: string;
    parent_division: number;
    department_description: string | null;
    department_head: string | null; // Legacy field
    department_head_id: number | null; // FK to user.user_id
    tax_id: number | null;
    date_added: string | null;
}

export interface DepartmentSchedule {
    schedule_id: number;
    department_id: number;
    working_days: number; // Number of working days per week
    work_start: string; // TIME format "HH:MM:SS"
    work_end: string; // TIME format "HH:MM:SS"
    lunch_start: string; // TIME format "HH:MM:SS"
    lunch_end: string; // TIME format "HH:MM:SS"
    break_start: string; // TIME format "HH:MM:SS"
    break_end: string; // TIME format "HH:MM:SS"
    workdays_note: string | null;
    grace_period: number;
    created_at: string;
    updated_at: string | null;
}

// ============================================================================
// ENRICHED TYPES (WITH JOINS)
// ============================================================================

export interface DepartmentScheduleWithRelations extends DepartmentSchedule {
    department?: Department; // Joined department
    department_head_user?: User; // Joined user via department
}

// ============================================================================
// FILTER TYPES
// ============================================================================

export interface DepartmentScheduleFilters {
    search: string; // Department name search
    dateRange: {
        from: Date | null;
        to: Date | null;
    };
}

// ============================================================================
// FORM TYPES (For CRUD)
// ============================================================================

export interface DepartmentScheduleFormData {
    department_id: number;
    working_days: number;
    work_start: string; // "HH:MM" format
    work_end: string; // "HH:MM" format
    lunch_start: string; // "HH:MM" format
    lunch_end: string; // "HH:MM" format
    break_start: string; // "HH:MM" format
    break_end: string; // "HH:MM" format
    workdays_note: string;
    grace_period: string;
}

export type CreateDepartmentScheduleData = DepartmentScheduleFormData;

export interface UpdateDepartmentScheduleData extends Partial<DepartmentScheduleFormData> {
    schedule_id: number;
}

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

export interface DepartmentSchedulesAPIResponse {
    schedules: DepartmentScheduleWithRelations[];
    departments: Department[];
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

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get full name from user object
 */
export function getUserFullName(user: User | undefined): string {
    if (!user) return "Not assigned";

    const parts = [user.user_fname, user.user_mname, user.user_lname]
        .filter(Boolean);
    return parts.join(" ");
}

/**
 * Convert 24-hour time to 12-hour format
 * @param time24 - Time in "HH:MM:SS" or "HH:MM" format
 * @returns Time in "h:MM AM/PM" format
 */
export function formatTime12Hour(time24: string): string {
    if (!time24) return "";

    const [hours, minutes] = time24.split(":");
    const hour = parseInt(hours, 10);
    const min = minutes || "00";

    if (hour === 0) return `12:${min} AM`;
    if (hour === 12) return `12:${min} PM`;
    if (hour < 12) return `${hour}:${min} AM`;
    return `${hour - 12}:${min} PM`;
}

/**
 * Convert 12-hour time to 24-hour format
 * @param time12 - Time in "HH:MM" format from input type="time"
 * @returns Time in "HH:MM:SS" format for database
 */
export function formatTime24Hour(time12: string): string {
    if (!time12) return "";
    return `${time12}:00`; // Add seconds
}

/**
 * Format time range for display
 * @param start - Start time in 24-hour format
 * @param end - End time in 24-hour format
 * @returns Formatted range like "8:00 AM - 5:00 PM"
 */
export function formatTimeRange(start: string, end: string): string {
    return `${formatTime12Hour(start)} - ${formatTime12Hour(end)}`;
}

/**
 * Format working days for display
 * @param days - Number of working days
 * @returns Formatted string like "5 days/week"
 */
export function formatWorkingDays(days: number): string {
    return `${days} day${days !== 1 ? 's' : ''}/week`;
}