import type { ProductionSchedule, ScheduleFormValues } from "../types";
import { LineRegistrationService } from "../../line-registration/services/LineRegistrationService";

export class SchedulingService {
    static async getSchedules(): Promise<ProductionSchedule[]> {
        try {
            const res = await fetch(`/api/hrm/manufacturing/schedules?limit=-1&sort=-schedule_date`);
            if (!res.ok) return [];
            const { data } = await res.json();
            return data || [];
        } catch (error) {
            console.error("Error fetching schedules:", error);
            return [];
        }
    }

    static async getScheduleById(id: number): Promise<ProductionSchedule | null> {
        try {
            const res = await fetch(`/api/hrm/manufacturing/schedules?id=${id}`);
            if (!res.ok) return null;
            const { data } = await res.json();
            return data || null;
        } catch (error) {
            console.error("Error fetching schedule by id:", error);
            return null;
        }
    }

    /**
     * Creates a new schedule. Performs business rule checks against targets and allowed headcounts,
     * sets the target/headcount approval status flags accordingly, and saves the records.
     */
    static async createSchedule(data: ScheduleFormValues): Promise<ProductionSchedule | null> {
        try {
            // 1. Fetch line details & positions to run verification rules
            const lineDetails = await LineRegistrationService.getLineById(data.line_id);
            if (!lineDetails) throw new Error("Selected production line not found.");

            // 2. Target approval logic: if target < standard target, require approval
            const targetApprovalStatus = data.daily_target < lineDetails.target_produce_8_hrs
                ? "PENDING_APPROVAL"
                : "NOT_REQUIRED";

            // 3. Headcount approval logic per position
            const positionMap = new Map(lineDetails.positions.map((p) => [p.id, p]));
            const positionsPayload = data.positions.map((pos) => {
                const spec = positionMap.get(pos.position_id);
                const allowed = spec ? spec.persons_allowed : 0;
                const headcountApprovalStatus = pos.assigned_persons > allowed
                    ? "PENDING_APPROVAL"
                    : "NOT_REQUIRED";

                return {
                    position_id: pos.position_id,
                    assigned_persons: pos.assigned_persons,
                    headcount_approval_status: headcountApprovalStatus,
                };
            });

            const schedulePayload = {
                schedule_date: data.schedule_date,
                line_id: data.line_id,
                daily_target: data.daily_target,
                actual_produce: data.actual_produce || 0,
                target_approval_status: targetApprovalStatus,
            };

            const res = await fetch(`/api/hrm/manufacturing/schedules`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(schedulePayload),
            });

            if (!res.ok) return null;
            const { data: created } = await res.json();
            const scheduleId = created.id;

            // 4. Create child positions linked to the newly created schedule ID
            const insertResults = await Promise.all(
                positionsPayload.map(async (pos) => {
                    try {
                        const childPayload = {
                            ...pos,
                            schedule_id: scheduleId,
                        };
                        const childRes = await fetch(`/api/hrm/manufacturing/schedule-positions`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify(childPayload),
                        });
                        return childRes.ok;
                    } catch (err) {
                        console.error(`Error saving schedule position:`, err);
                        return false;
                    }
                })
            );

            if (insertResults.includes(false)) {
                console.warn("[SchedulingService] Some schedule positions failed to save.");
            }

            return created;
        } catch (error) {
            console.error("Error creating schedule:", error);
            return null;
        }
    }

    /**
     * Updates an existing schedule, re-running validation checks and syncing child positions.
     */
    static async updateSchedule(id: number, data: ScheduleFormValues, currentSchedule: ProductionSchedule): Promise<boolean> {
        try {
            // 1. Fetch line details & positions
            const lineDetails = await LineRegistrationService.getLineById(data.line_id);
            if (!lineDetails) throw new Error("Selected production line not found.");

            // 2. Target approval logic
            // If standard targets changed or target was modified, recheck. If already approved/rejected, we don't force reset unless target changed.
            let targetApprovalStatus = currentSchedule.target_approval_status;
            if (data.daily_target !== currentSchedule.daily_target) {
                targetApprovalStatus = data.daily_target < lineDetails.target_produce_8_hrs
                    ? "PENDING_APPROVAL"
                    : "NOT_REQUIRED";
            }

            // Update main schedule details
            const schedulePayload = {
                schedule_date: data.schedule_date,
                line_id: data.line_id,
                daily_target: data.daily_target,
                actual_produce: data.actual_produce ?? currentSchedule.actual_produce,
                target_approval_status: targetApprovalStatus,
            };

            const schedRes = await fetch(`/api/hrm/manufacturing/schedules?id=${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(schedulePayload),
            });

            if (!schedRes.ok) return false;

            // 3. Positions Sync: Delete existing positions and recreate them
            const currentPosList = currentSchedule.positions || currentSchedule.manu_hr_schedule_positions || [];
            if (currentPosList.length > 0) {
                const staleIds = currentPosList.map((p) => p.id);
                // Delete stale positions individually by ID (standard proxy path, bodyless)
                await Promise.all(
                    staleIds.map(async (staleId) => {
                        try {
                            const delRes = await fetch(`/api/hrm/manufacturing/schedule-positions?id=${staleId}`, {
                                method: "DELETE",
                            });
                            if (!delRes.ok) {
                                console.error(`[SchedulingService] Failed to delete stale position ID ${staleId}`);
                            }
                        } catch (err) {
                            console.error(`[SchedulingService] Stale position delete error:`, err);
                        }
                    })
                );
            }

            // Create new positions payload
            const positionMap = new Map(lineDetails.positions.map((p) => [p.id, p]));
            const positionsPayload = data.positions.map((pos) => {
                const spec = positionMap.get(pos.position_id);
                const allowed = spec ? spec.persons_allowed : 0;
                const headcountApprovalStatus = pos.assigned_persons > allowed
                    ? "PENDING_APPROVAL"
                    : "NOT_REQUIRED";

                return {
                    schedule_id: id,
                    position_id: pos.position_id,
                    assigned_persons: pos.assigned_persons,
                    headcount_approval_status: headcountApprovalStatus,
                };
            });

            // Insert new positions in parallel with strict error validation
            const insertResults = await Promise.all(
                positionsPayload.map(async (posPayload) => {
                    try {
                        const res = await fetch(`/api/hrm/manufacturing/schedule-positions`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify(posPayload),
                        });
                        if (!res.ok) {
                            const errBody = await res.text();
                            console.error(`[SchedulingService] Failed to insert position:`, errBody);
                            return false;
                        }
                        return true;
                    } catch (err) {
                        console.error(`[SchedulingService] Network error inserting position:`, err);
                        return false;
                    }
                })
            );

            if (insertResults.includes(false)) {
                return false;
            }

            return true;
        } catch (error) {
            console.error("Error updating schedule:", error);
            return false;
        }
    }

    static async deleteSchedule(id: number): Promise<boolean> {
        try {
            const res = await fetch(`/api/hrm/manufacturing/schedules?id=${id}`, {
                method: "DELETE",
            });
            return res.ok || res.status === 204;
        } catch (error) {
            console.error("Error deleting schedule:", error);
            return false;
        }
    }

    /**
     * Admin Control: Approves a schedule target
     */
    static async approveTarget(id: number, userId: number | null): Promise<boolean> {
        try {
            const res = await fetch(`/api/hrm/manufacturing/schedules?id=${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    target_approval_status: "APPROVED",
                    target_approved_by: userId,
                }),
            });
            return res.ok;
        } catch (error) {
            console.error("Error approving target:", error);
            return false;
        }
    }

    /**
     * Admin Control: Approves headcount for a specific schedule position item
     */
    static async approveHeadcount(posItemId: number, userId: number | null): Promise<boolean> {
        try {
            const res = await fetch(`/api/hrm/manufacturing/schedule-positions?id=${posItemId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    headcount_approval_status: "APPROVED",
                    headcount_approved_by: userId,
                }),
            });
            return res.ok;
        } catch (error) {
            console.error("Error approving headcount:", error);
            return false;
        }
    }
}
