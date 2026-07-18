/* eslint-disable */
import type { ProductionSchedule, ScheduleFormValues } from "../types";
import { LineRegistrationService } from "../../line-registration/services/LineRegistrationService";

export class SchedulingService {
    static async getSchedules(): Promise<ProductionSchedule[]> {
        try {
            // Fetch lines independently to ensure we have full line data
            const linesRes = await fetch(`/api/hrm/manufacturing/lines?limit=-1`);
            const linesList = linesRes.ok ? ((await linesRes.json()).data || []) : [];
            const linesMap = new Map(linesList.map((l: any) => [l.id, l]));

            const res = await fetch(`/api/hrm/manufacturing/schedules?limit=-1&sort=-schedule_date&filter[deleted_at][_null]=true&fields=*,line_id.*,user_created.first_name,user_created.last_name`);
            if (!res.ok) return [];
            const { data } = await res.json();
            const schedules = data || [];

            // Fetch positions manually since Directus O2M alias might not be configured
            const posRes = await fetch(`/api/hrm/manufacturing/schedule-positions?limit=-1&fields=*,position_id.*`);
            if (posRes.ok) {
                const { data: posData } = await posRes.json();
                const allPositions = posData || [];
                schedules.forEach((sched: any) => {
                    const lineIdNum = typeof sched.line_id === 'object' && sched.line_id !== null ? sched.line_id.id : sched.line_id;
                    sched.line = linesMap.get(lineIdNum) || sched.line_id;
                    
                    sched.positions = allPositions
                        .filter((p: any) => p.schedule_id === sched.id)
                        .map((p: any) => ({ ...p, position: p.position_id }));
                });
            }

            return schedules;
        } catch (error) {
            console.error("Error fetching schedules:", error);
            return [];
        }
    }

    static async getScheduleById(id: number): Promise<ProductionSchedule | null> {
        try {
            const res = await fetch(`/api/hrm/manufacturing/schedules?id=${id}&fields=*,line_id.*`);
            if (!res.ok) return null;
            const { data } = await res.json();
            const schedule = data;
            if (!schedule) return null;

            // Fetch line data explicitly to ensure full population
            const lineIdNum = typeof schedule.line_id === 'object' && schedule.line_id !== null ? schedule.line_id.id : schedule.line_id;
            const lineRes = await fetch(`/api/hrm/manufacturing/lines?id=${lineIdNum}`);
            if (lineRes.ok) {
                const { data: lineData } = await lineRes.json();
                schedule.line = lineData || schedule.line_id;
            } else {
                schedule.line = schedule.line_id;
            }

            const posRes = await fetch(`/api/hrm/manufacturing/schedule-positions?filter[schedule_id][_eq]=${id}&fields=*,position_id.*`);
            if (posRes.ok) {
                const { data: posData } = await posRes.json();
                schedule.positions = (posData || []).map((p: any) => ({ ...p, position: p.position_id }));
            }

            return schedule;
        } catch (error) {
            console.error("Error fetching schedule by id:", error);
            return null;
        }
    }

    /**
     * Creates a new schedule. Performs business rule checks against targets and allowed headcounts,
     * sets the target/headcount approval status flags accordingly, and saves the records.
     */
    static async createSchedule(data: ScheduleFormValues, userId: number | null = null): Promise<ProductionSchedule | null> {
        try {
            // 0. Overlap check: ensure no overlapping schedule for the same line and date
            const existRes = await fetch(`/api/hrm/manufacturing/schedules?filter[line_id][_eq]=${data.line_id}&filter[schedule_date][_eq]=${data.schedule_date}&filter[deleted_at][_null]=true&fields=id,start_time,end_time`);
            if (existRes.ok) {
                const existData = await existRes.json();
                const existingSchedules = existData.data || [];
                const newStart = data.start_time;
                const newEnd = data.end_time;
                
                for (const existing of existingSchedules) {
                    if (existing.start_time && existing.end_time) {
                        // Check for overlap: new_start < existing_end AND new_end > existing_start
                        if (newStart < existing.end_time && newEnd > existing.start_time) {
                            throw new Error("A schedule already exists for this line during the selected time.");
                        }
                    } else {
                        // If there's a schedule without time, we assume it's a full-day schedule and block it.
                        throw new Error("A legacy full-day schedule already exists for this line on this date.");
                    }
                }
            }

            // 1. Fetch line details & positions to run verification rules
            const lineDetails = await LineRegistrationService.getLineById(data.line_id);
            if (!lineDetails) throw new Error("Selected production line not found.");

            // 2. Target approval logic: if target < standard target, require approval
            const targetRequiresApproval = data.daily_target < lineDetails.target_produce_8_hrs;

            // 3. Headcount approval logic per position
            const positionMap = new Map(lineDetails.positions.map((p) => [p.id, p]));
            
            let anyHeadcountRequiresApproval = false;
            
            const positionsPayload = data.positions.map((pos) => {
                const spec = positionMap.get(pos.position_id);
                const allowed = spec ? spec.persons_allowed : 0;
                const posRequiresApproval = pos.assigned_persons > allowed;
                if (posRequiresApproval) {
                    anyHeadcountRequiresApproval = true;
                }

                return {
                    position_id: pos.position_id,
                    assigned_persons: pos.assigned_persons,
                    // Legacy field fallback to prevent DB rejection if schema is not yet updated
                    headcount_approval_status: posRequiresApproval ? "PENDING_APPROVAL" : "NOT_REQUIRED",
                    created_by: userId,
                };
            });

            const overallApprovalStatus = (targetRequiresApproval || anyHeadcountRequiresApproval) 
                ? "PENDING_APPROVAL" 
                : "NOT_REQUIRED";

            const schedulePayload: any = {
                schedule_date: data.schedule_date,
                start_time: data.start_time,
                end_time: data.end_time,
                line_id: data.line_id,
                daily_target: data.daily_target,
                actual_produce: 0,
                approval_status: overallApprovalStatus,
                // Legacy field fallback
                target_approval_status: targetRequiresApproval ? "PENDING_APPROVAL" : "NOT_REQUIRED",
                created_by: userId,
                updated_by: userId,
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
        } catch (error: any) {
            throw new Error(error.message || "Failed to create schedule.");
        }
    }

    /**
     * Updates an existing schedule, re-running validation checks and syncing child positions.
     */
    static async updateSchedule(id: number, data: ScheduleFormValues, currentSchedule: ProductionSchedule, userId: number | null = null): Promise<boolean> {
        try {

            // 0. Overlap check: ensure no overlapping schedule for the same line and date (excluding current)
            const existRes = await fetch(`/api/hrm/manufacturing/schedules?filter[line_id][_eq]=${data.line_id}&filter[schedule_date][_eq]=${data.schedule_date}&filter[id][_neq]=${id}&filter[deleted_at][_null]=true&fields=id,start_time,end_time`);
            if (existRes.ok) {
                const existData = await existRes.json();
                const existingSchedules = existData.data || [];
                const newStart = data.start_time;
                const newEnd = data.end_time;
                
                for (const existing of existingSchedules) {
                    if (existing.start_time && existing.end_time) {
                        if (newStart < existing.end_time && newEnd > existing.start_time) {
                            throw new Error("A schedule already exists for this line during the selected time.");
                        }
                    } else {
                        throw new Error("A legacy full-day schedule already exists for this line on this date.");
                    }
                }
            }

            // 1. Fetch line details & positions
            const lineDetails = await LineRegistrationService.getLineById(data.line_id);
            if (!lineDetails) throw new Error("Selected production line not found.");

            // 2. Target approval logic
            const targetRequiresApproval = data.daily_target < lineDetails.target_produce_8_hrs;
            
            // 3. Headcount approval logic
            const positionMap = new Map(lineDetails.positions.map((p) => [p.id, p]));
            let anyHeadcountRequiresApproval = false;
            const positionsPayloadData = data.positions.map((pos) => {
                const spec = positionMap.get(pos.position_id);
                const allowed = spec ? spec.persons_allowed : 0;
                const posRequiresApproval = pos.assigned_persons > allowed;
                if (posRequiresApproval) {
                    anyHeadcountRequiresApproval = true;
                }
                return { ...pos, posRequiresApproval };
            }); 
            
            let overallApprovalStatus = currentSchedule.approval_status;
            
            // If it's already APPROVED or REJECTED, we might still reset to PENDING if they introduce new deviations.
            // Or if they fix all deviations, it goes back to NOT_REQUIRED.
            if (targetRequiresApproval || anyHeadcountRequiresApproval) {
                // If it's currently NOT_REQUIRED, and they added a deviation, make it PENDING.
                // If it's REJECTED, and they edit it, put it back to PENDING.
                // If it's APPROVED, we could leave it APPROVED or reset. Let's reset to PENDING if a NEW edit happens,
                // but usually the UI disables edits on APPROVED schedules.
                overallApprovalStatus = "PENDING_APPROVAL";
            } else {
                overallApprovalStatus = "NOT_REQUIRED";
            }

            // Update main schedule details
            const schedulePayload: any = {
                schedule_date: data.schedule_date,
                start_time: data.start_time,
                end_time: data.end_time,
                line_id: data.line_id,
                daily_target: data.daily_target,
                actual_produce: currentSchedule.actual_produce || 0,
                approval_status: overallApprovalStatus,
                // Legacy field fallback
                target_approval_status: targetRequiresApproval ? "PENDING_APPROVAL" : "NOT_REQUIRED",
                updated_by: userId,
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

            const positionsPayload = positionsPayloadData.map((pos) => {
                return {
                    schedule_id: id,
                    position_id: pos.position_id,
                    assigned_persons: pos.assigned_persons,
                    // Legacy field fallback
                    headcount_approval_status: pos.posRequiresApproval ? "PENDING_APPROVAL" : "NOT_REQUIRED",
                    created_by: userId,
                    updated_by: userId,
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
        } catch (error: any) {
            throw new Error(error.message || "Failed to update schedule.");
        }
    }

    static async deleteSchedule(id: number, userId: number | null = null, reason: string | null = null): Promise<boolean> {
        try {
            const res = await fetch(`/api/hrm/manufacturing/schedules?id=${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    deleted_at: new Date().toISOString(),
                    deleted_by: userId,
                    deleted_reason: reason,
                }),
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
