import type { PendingApprovalItem } from "../types";
import { SchedulingService } from "../../production-scheduling/services/SchedulingService";

export class ApprovalService {
    static async getPendingApprovals(): Promise<PendingApprovalItem[]> {
        try {
            const schedules = await SchedulingService.getSchedules();
            const pendingItems: PendingApprovalItem[] = [];

            schedules.forEach((sched) => {
                const lineName = sched.line?.line_name || `Line #${sched.line_id}`;
                const stdTarget = sched.line?.target_produce_8_hrs || 0;

                // 1. Check Target Approval Status
                if (sched.target_approval_status === "PENDING_APPROVAL") {
                    pendingItems.push({
                        id: `target_${sched.id}`,
                        type: "target",
                        schedule_id: sched.id,
                        date: sched.schedule_date,
                        line_name: lineName,
                        target_value: {
                            requested: sched.daily_target,
                            standard: stdTarget,
                        },
                        status: "PENDING_APPROVAL",
                        raw_schedule: sched,
                    });
                }

                // 2. Check Headcount Approval Statuses
                const positions = sched.positions || sched.manu_hr_schedule_positions || [];
                positions.forEach((pos) => {
                    if (pos.headcount_approval_status === "PENDING_APPROVAL") {
                        const posName = pos.position?.position_name || `Position #${pos.position_id}`;
                        const allowedCount = pos.position?.persons_allowed || 0;

                        pendingItems.push({
                            id: `headcount_${pos.id}`,
                            type: "headcount",
                            schedule_id: sched.id,
                            date: sched.schedule_date,
                            line_name: lineName,
                            headcount_value: {
                                position_name: posName,
                                assigned: pos.assigned_persons,
                                allowed: allowedCount,
                                position_item_id: pos.id,
                            },
                            status: "PENDING_APPROVAL",
                            raw_schedule: sched,
                            raw_position_item: pos,
                        });
                    }
                });
            });

            // Sort by schedule date descending
            return pendingItems.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        } catch (error) {
            console.error("Error processing pending approvals:", error);
            return [];
        }
    }

    static async updateTargetStatus(id: number, status: "APPROVED" | "REJECTED", userId: number | null): Promise<boolean> {
        try {
            const res = await fetch(`/api/hrm/manufacturing/schedules?id=${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    target_approval_status: status,
                    target_approved_by: userId,
                }),
            });
            return res.ok;
        } catch (error) {
            console.error("Error updating target approval status:", error);
            return false;
        }
    }

    static async updateHeadcountStatus(posItemId: number, status: "APPROVED" | "REJECTED", userId: number | null): Promise<boolean> {
        try {
            const res = await fetch(`/api/hrm/manufacturing/schedule-positions?id=${posItemId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    headcount_approval_status: status,
                    headcount_approved_by: userId,
                }),
            });
            return res.ok;
        } catch (error) {
            console.error("Error updating headcount approval status:", error);
            return false;
        }
    }
}
