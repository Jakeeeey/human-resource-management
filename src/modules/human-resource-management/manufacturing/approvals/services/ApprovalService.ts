/* eslint-disable */
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

                let statusVal = sched.approval_status || sched.target_approval_status;
                const isTargetDeviation = sched.daily_target < stdTarget;
                
                const positions = sched.positions || sched.manu_hr_schedule_positions || [];
                const anyHeadcountRequiresApproval = positions.some(pos => pos.assigned_persons > (pos.position?.persons_allowed || 0));

                // Force pending status if deviations exist and it hasn't been explicitly approved/rejected
                if ((isTargetDeviation || anyHeadcountRequiresApproval) && statusVal !== "APPROVED" && statusVal !== "REJECTED") {
                    statusVal = "PENDING_APPROVAL";
                }

                const isPending = statusVal === "PENDING_APPROVAL";
                
                if (isPending) {
                    const item: PendingApprovalItem = {
                        id: String(sched.id),
                        type: "schedule",
                        schedule_id: sched.id,
                        date: sched.schedule_date,
                        line_name: lineName,
                        deviations: { headcounts: [] },
                        status: "PENDING_APPROVAL",
                        raw_schedule: sched,
                    };

                    if (isTargetDeviation) {
                        item.deviations.target = {
                            requested: sched.daily_target,
                            standard: stdTarget,
                        };
                    }

                    positions.forEach((pos) => {
                        const posName = pos.position?.position_name || `Position #${pos.position_id}`;
                        const allowedCount = pos.position?.persons_allowed || 0;
                        item.deviations.headcounts.push({
                            position_name: posName,
                            assigned: pos.assigned_persons,
                            allowed: allowedCount,
                            position_item_id: pos.id,
                        });
                    });

                    pendingItems.push(item);
                }
            });

            // Sort by schedule date descending
            return pendingItems.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        } catch (error) {
            console.error("Error processing pending approvals:", error);
            return [];
        }
    }

    static async processScheduleStatus(scheduleId: number, status: "APPROVED" | "REJECTED", userId: number | null, reason: string | null = null): Promise<boolean> {
        try {
            const sched = await SchedulingService.getScheduleById(scheduleId);
            if (!sched) return false;

            const now = new Date().toISOString();
            const payload: any = {
                approval_status: status,
                // Legacy fallback
                target_approval_status: status,
            };

            if (status === "APPROVED") {
                payload.approved_by = userId;
                payload.approved_at = now;
                payload.target_approved_by = userId;
            } else if (status === "REJECTED") {
                payload.rejected_by = userId;
                payload.rejected_at = now;
                if (reason) {
                    payload.rejected_reason = reason;
                }
            }

            const res = await fetch(`/api/hrm/manufacturing/schedules?id=${scheduleId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            
            return res.ok || res.status === 204;
        } catch (error) {
            console.error("Error updating schedule status:", error);
            return false;
        }
    }
}
