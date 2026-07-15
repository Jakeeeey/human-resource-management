import { z } from "zod";
import type { ManufacturingLine, LinePosition } from "../line-registration/types";

export interface ProductionSchedule {
    id: number;
    schedule_date: string;
    line_id: number;
    daily_target: number;
    actual_produce: number;
    target_approval_status: "NOT_REQUIRED" | "PENDING_APPROVAL" | "APPROVED" | "REJECTED";
    target_approved_by: number | null;
    created_by: number | null;
    created_at: string;
    updated_by: number | null;
    updated_at: string;
    
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
    headcount_approval_status: "NOT_REQUIRED" | "PENDING_APPROVAL" | "APPROVED" | "REJECTED";
    headcount_approved_by: number | null;
    created_by: number | null;
    created_at: string;
    updated_by: number | null;
    updated_at: string;

    // Extracted joins
    position?: LinePosition;
}

export const scheduleFormSchema = z.object({
    schedule_date: z.string().min(1, "Date is required"),
    line_id: z.number().int().min(1, "Line is required"),
    daily_target: z.number().int().min(1, "Daily target must be at least 1"),
    actual_produce: z.number().int().min(0).optional().default(0),
    positions: z.array(
        z.object({
            position_id: z.number().int().min(1),
            assigned_persons: z.number().int().min(0, "Assigned persons cannot be negative"),
        })
    ).min(1, "At least one position must be configured"),
});

export type ScheduleFormValues = z.infer<typeof scheduleFormSchema>;
