/* eslint-disable */
import type { ProductionSchedule, ScheduleAttendance } from "../../production-scheduling/types";

export class ProductionOutputService {
    static async updateActualProduce(id: number, actualProduce: number, isPosted: boolean, userId: number | null = null): Promise<boolean> {
        try {
            const body: any = {
                actual_produce: actualProduce,
                is_output_posted: isPosted,
                updated_by: userId,
            };

            const res = await fetch(`/api/hrm/manufacturing/schedules?id=${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });

            return res.ok;
        } catch (error) {
            console.error("Error updating actual produce:", error);
            return false;
        }
    }

    static async getScheduleAttendance(scheduleId: number): Promise<ScheduleAttendance[]> {
        try {
            const res = await fetch(`/api/hrm/manufacturing/schedules/attendance?schedule_id=${scheduleId}`);
            if (!res.ok) throw new Error("Failed to fetch schedule attendance");
            const data = await res.json();
            return data.data || [];
        } catch (error) {
            console.error("Error fetching schedule attendance:", error);
            return [];
        }
    }

    static calculateScheduleCost(schedule: ProductionSchedule, attendanceLogs: ScheduleAttendance[]): { actualCost: number, estCost: number } {
        let workingHours = 8;
        if (schedule.start_time && schedule.end_time) {
            const start = schedule.start_time.split(":");
            const end = schedule.end_time.split(":");
            const startH = parseInt(start[0], 10) + parseInt(start[1], 10)/60;
            const endH = parseInt(end[0], 10) + parseInt(end[1], 10)/60;
            const elapsedHours = endH > startH ? endH - startH : (endH + 24) - startH;
            workingHours = Math.max(0, elapsedHours - 1);
        }

        const hasManuPositions = schedule.manu_hr_schedule_positions && schedule.manu_hr_schedule_positions.length > 0;
        const posData = hasManuPositions ? schedule.manu_hr_schedule_positions! : (schedule.positions || []);

        const parseDate = (dStr: string) => {
            const d = new Date(dStr);
            return !isNaN(d.getTime()) ? d : null;
        };
        const diffMins = (d1: Date, d2: Date) => (d1.getTime() - d2.getTime()) / 60000;

        const computeMetrics = (log: ScheduleAttendance) => {
            if (!log.time_in) return null;
            const timeIn = parseDate(log.time_in);
            const timeOut = log.time_out ? parseDate(log.time_out) : null;
            if (!timeIn) return null;

            let totalWorkingMins = 0;
            if (timeOut) {
                totalWorkingMins = diffMins(timeOut, timeIn);
                if (log.lunch_start && log.lunch_end) {
                    const lS = parseDate(log.lunch_start);
                    const lE = parseDate(log.lunch_end);
                    if (lS && lE) totalWorkingMins -= diffMins(lE, lS);
                }
                if (log.break_start && log.break_end) {
                    const bS = parseDate(log.break_start);
                    const bE = parseDate(log.break_end);
                    if (bS && bE) totalWorkingMins -= diffMins(bE, bS);
                }
                if (totalWorkingMins < 0) totalWorkingMins = 0;
            }

            return { workingHoursRaw: totalWorkingMins };
        };

        const actualCost = posData.reduce((acc, pos) => {
            const posObj: any = pos.position || pos.position_id;
            const posId = posObj?.id || (typeof pos.position_id === 'number' ? pos.position_id : undefined);
            const posAttendance = attendanceLogs.filter(a => a.position_id === posId && a.time_in) || [];
            const hourlyRate = Number(posObj?.position_rate || 0) / 8;
            
            const posCost = posAttendance.reduce((posAcc, log) => {
                const metrics = computeMetrics(log);
                if (metrics) {
                    if (metrics.workingHoursRaw > 0) {
                        return posAcc + ((metrics.workingHoursRaw / 60) * hourlyRate);
                    } else {
                        return posAcc + (workingHours * hourlyRate);
                    }
                }
                return posAcc;
            }, 0);
            
            return acc + posCost;
        }, 0);

        const estCost = posData.reduce((acc, pos) => {
            const posObj: any = pos.position || pos.position_id;
            const setPersons = Number(pos.assigned_persons || 0);
            const hourlyRate = Number(posObj?.position_rate || 0) / 8;
            return acc + (setPersons * hourlyRate * workingHours);
        }, 0);

        return { actualCost, estCost };
    }
}


