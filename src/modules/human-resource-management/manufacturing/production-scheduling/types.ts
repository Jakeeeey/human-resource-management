/* eslint-disable */
import { z } from "zod";
import type { ManufacturingLine, LinePosition } from "../line-registration/types";

export interface ProductionSchedule {
    id: number;
    schedule_date: string;
    line_id: number;
    daily_target: number;
    actual_produce: number;
    start_time?: string | null;
    end_time?: string | null;
    approval_status?: "NOT_REQUIRED" | "PENDING_APPROVAL" | "APPROVED" | "REJECTED";
    approved_by?: number | null;
    // Legacy fallbacks
    target_approval_status?: "NOT_REQUIRED" | "PENDING_APPROVAL" | "APPROVED" | "REJECTED";
    target_approved_by?: number | null;
    created_by: number | null;
    created_at: string;
    updated_by: number | null;
    updated_at: string;
    is_output_posted?: boolean | null;
    
    // Soft delete & Approval Tracking
    deleted_at?: string | null;
    deleted_by?: number | null;
    deleted_reason?: string | null;
    approved_at?: string | null;
    rejected_by?: number | null;
    rejected_at?: string | null;
    
    // Extracted joins
    line?: ManufacturingLine;
    positions?: SchedulePosition[];
    manu_hr_schedule_positions?: SchedulePosition[];
}

export interface SchedulePosition {
    id: number;
    schedule_id: number;
    position_id: number;
    assigned_persons: number;
    // Legacy fallbacks
    headcount_approval_status?: "NOT_REQUIRED" | "PENDING_APPROVAL" | "APPROVED" | "REJECTED";
    headcount_approved_by?: number | null;
    created_by: number | null;
    created_at: string;
    updated_by: number | null;
    updated_at: string;
    actual_persons?: number | null;

    // Extracted joins
    position?: LinePosition;
}

export interface ScheduleAttachment {
    id: number;
    schedule_id: number;
    file_name: string;
    file_path: string;
    file_type?: string | null;
    file_size_bytes?: number | null;
    created_by?: number | null;
    created_at?: string | null;
    deleted_at?: string | null;
    deleted_by?: number | null;
}

export interface ScheduleAttendance {
    id: number;
    schedule_id: number;
    position_id: number;
    user_id: any; // User object joined from Directus
    attendance_log_id: number;
    rf_id_tapped?: string | null;
    time_in?: string | null;
    lunch_start?: string | null;
    lunch_end?: string | null;
    break_start?: string | null;
    break_end?: string | null;
    time_out?: string | null;
    assigned_at?: string | null;
}


export const scheduleFormSchema = z.object({
    schedule_date: z.string().min(1, "Date is required"),
    start_time: z.string().min(1, "Start time is required"),
    end_time: z.string().min(1, "End time is required"),
    line_id: z.number().int().min(1, "Line is required"),
    daily_target: z.number().int().min(1, "Daily target must be at least 1"),
    positions: z.array(
        z.object({
            position_id: z.number().int().min(1),
            assigned_persons: z.number().int().min(0, "Assigned persons cannot be negative"),
        })
    ).min(1, "At least one position must be configured"),
}).refine((data) => {
    // Basic time validation: end_time must be strictly after start_time if on same day
    return data.end_time > data.start_time;
}, {
    message: "End time must be strictly after start time",
    path: ["end_time"],
});

export type ScheduleFormValues = z.infer<typeof scheduleFormSchema>;
