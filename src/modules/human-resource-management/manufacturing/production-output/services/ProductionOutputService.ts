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
}
