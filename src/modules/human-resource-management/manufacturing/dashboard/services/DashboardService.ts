/* eslint-disable */
import { DashboardStats, ChartDataPoint } from "../types";
import { format, parseISO } from "date-fns";

const UPSTREAM_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;
const TOKEN = process.env.DIRECTUS_STATIC_TOKEN;

export class DashboardService {
    static async getDashboardStats(startDate: string, endDate: string, lineId?: string | null): Promise<DashboardStats> {
        if (!UPSTREAM_BASE) throw new Error("API base URL is not configured");

        const headers = new Headers();
        headers.set("content-type", "application/json");
        if (TOKEN) headers.set("Authorization", `Bearer ${TOKEN}`);

        try {
            // 1. Fetch schedules in date range
            const schedUrl = new URL(`${UPSTREAM_BASE.replace(/\/+$/, "")}/items/manu_hr_schedules`);
            schedUrl.searchParams.set("limit", "-1");
            schedUrl.searchParams.set("filter[deleted_at][_null]", "true");
            schedUrl.searchParams.set("filter[schedule_date][_between]", `${startDate},${endDate}`);
            if (lineId && lineId !== "all") {
                schedUrl.searchParams.set("filter[line_id][_eq]", lineId);
            }
            
            const schedRes = await fetch(schedUrl.toString(), { method: "GET", headers, cache: "no-store" });
            if (!schedRes.ok) throw new Error("Failed to fetch schedules");
            const { data: schedules } = await schedRes.json();

            if (!schedules || schedules.length === 0) {
                return {
                    totalWorkingPeople: 0,
                    totalSetWorkers: 0,
                    totalActualProduce: 0,
                    totalTargetProduce: 0,
                    productivityPercentage: 0,
                    chartData: []
                };
            }

            const scheduleIds = schedules.map((s: any) => s.id);

            // 2. Fetch attendance logs and positions for these schedules
            let totalActualWorkers = 0;
            let totalSetWorkers = 0;
            const workforceMap: Record<string, { set: number, actual: number }> = {};

            schedules.forEach((s: any) => {
                workforceMap[s.schedule_date] = { set: 0, actual: 0 };
            });

            if (scheduleIds.length > 0) {
                // Fetch Attendance
                const attUrl = new URL(`${UPSTREAM_BASE.replace(/\/+$/, "")}/items/manu_hr_schedule_attendance`);
                attUrl.searchParams.set("limit", "-1");
                attUrl.searchParams.set("filter[schedule_id][_in]", scheduleIds.join(","));
                
                const attRes = await fetch(attUrl.toString(), { method: "GET", headers, cache: "no-store" });
                if (attRes.ok) {
                    const { data: attendance } = await attRes.json();
                    if (attendance && attendance.length > 0) {
                        totalActualWorkers = attendance.length;
                        attendance.forEach((a: any) => {
                            const sched = schedules.find((s: any) => s.id === a.schedule_id);
                            if (sched && sched.schedule_date) {
                                workforceMap[sched.schedule_date].actual += 1;
                            }
                        });
                    }
                }

                // Fetch Positions (Target Workforce)
                const posUrl = new URL(`${UPSTREAM_BASE.replace(/\/+$/, "")}/items/manu_hr_schedule_positions`);
                posUrl.searchParams.set("limit", "-1");
                posUrl.searchParams.set("filter[schedule_id][_in]", scheduleIds.join(","));
                
                const posRes = await fetch(posUrl.toString(), { method: "GET", headers, cache: "no-store" });
                if (posRes.ok) {
                    const { data: positions } = await posRes.json();
                    if (positions && positions.length > 0) {
                        positions.forEach((p: any) => {
                            totalSetWorkers += (p.assigned_persons || 0);
                            const sched = schedules.find((s: any) => s.id === p.schedule_id);
                            if (sched && sched.schedule_date) {
                                workforceMap[sched.schedule_date].set += (p.assigned_persons || 0);
                            }
                        });
                    }
                }
            }

            // 3. Aggregate totals
            let totalActualProduce = 0;
            let totalTargetProduce = 0;
            const dateMap: Record<string, { target: number, actual: number }> = {};

            schedules.forEach((s: any) => {
                totalActualProduce += (s.actual_produce || 0);
                totalTargetProduce += (s.daily_target || 0);

                const dateStr = s.schedule_date;
                if (!dateMap[dateStr]) {
                    dateMap[dateStr] = { target: 0, actual: 0 };
                }
                dateMap[dateStr].target += (s.daily_target || 0);
                dateMap[dateStr].actual += (s.actual_produce || 0);
            });

            // 4. Calculate Productivity
            let productivityPercentage = 0;
            if (totalTargetProduce > 0) {
                productivityPercentage = Math.round((totalActualProduce / totalTargetProduce) * 100);
            } else if (totalActualProduce > 0) {
                productivityPercentage = 100;
            }

            // 5. Build Chart Data
            const sortedDates = Object.keys(dateMap).sort();
            const chartData: ChartDataPoint[] = sortedDates.map(date => ({
                date: format(parseISO(date), "MMM dd"),
                target: dateMap[date].target,
                actual: dateMap[date].actual,
                targetWorkers: workforceMap[date]?.set || 0,
                actualWorkers: workforceMap[date]?.actual || 0,
            }));

            return {
                totalWorkingPeople: totalActualWorkers, // Keeping this field for backward compatibility
                totalSetWorkers,
                totalActualProduce,
                totalTargetProduce,
                productivityPercentage,
                chartData
            };
        } catch (error) {
            console.error("[DashboardService] Error:", error);
            throw error;
        }
    }
}
