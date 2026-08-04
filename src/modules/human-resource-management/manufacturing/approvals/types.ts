import type { ProductionSchedule } from "../production-scheduling/types";

export type PendingApprovalItem = {
    id: string; // schedule_id as string
    type: "schedule";
    schedule_id: number;
    date: string;
    line_name: string;
    
    // Detailed deviations
    deviations: {
        target?: {
            requested: number;
            standard: number;
        };
        headcounts: Array<{
            position_name: string;
            assigned: number;
            allowed: number;
            position_item_id: number;
        }>;
    };
    
    status: "PENDING_APPROVAL" | "APPROVED" | "REJECTED";
    raw_schedule: ProductionSchedule;
};
