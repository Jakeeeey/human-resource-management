import { z } from "zod";

/**
 * On-Call Schedule Schema
 * Represents a department's on-call schedule for a specific date/team.
 */
export const OnCallScheduleSchema = z.object({
    id: z.number().optional(),
    department_id: z.number(),
    group: z.string(),
    schedule_date: z.string(), // ISO Date string (YYYY-MM-DD)
    work_start: z.string(),
    work_end: z.string(),
    lunch_start: z.string().nullable(),
    lunch_end: z.string().nullable(),
    break_start: z.string().nullable(),
    break_end: z.string().nullable(),
    working_days: z.number().default(6),
    workdays: z.string().nullable(), // e.g., "Mon,Tue,Wed,Thu,Fri,Sat"
    grace_period: z.number().default(5),
    created_at: z.string().optional(),
    updated_at: z.string().nullable().optional(),
    encoder_id: z.number().optional(),
});

export type OnCallSchedule = z.infer<typeof OnCallScheduleSchema>;

/**
 * On-Call List Schema
 * Links users to on-call schedules.
 */
export const OnCallListSchema = z.object({
    id: z.number().optional(),
    dept_sched_id: z.number(),
    user_id: z.number(),
});

export type OnCallList = z.infer<typeof OnCallListSchema>;

/**
 * Enriched On-Call Schedule
 * Includes joined data for UI display.
 */
export interface EnrichedOnCallSchedule extends OnCallSchedule {
    department_name?: string;
    assigned_staff: {
        user_id: number;
        user_fname: string;
        user_lname: string;
        user_email?: string;
    }[];
    last_edited_by?: {
        user_fname: string;
        user_lname: string;
        updated_at: string | null;
    };
}
