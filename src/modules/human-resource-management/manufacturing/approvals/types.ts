import type { ProductionSchedule, SchedulePosition } from "../production-scheduling/types";

export type PendingApprovalItem = {
    id: string; // Composite ID like 'target_1' or 'headcount_2'
    type: "target" | "headcount";
    schedule_id: number;
    date: string;
    line_name: string;
    
    // Details
    target_value?: {
        requested: number;
        standard: number;
    };
    headcount_value?: {
        position_name: string;
        assigned: number;
        allowed: number;
        position_item_id: number;
    };
    
    status: "PENDING_APPROVAL" | "APPROVED" | "REJECTED";
    raw_schedule: ProductionSchedule;
    raw_position_item?: SchedulePosition;
};
