/* eslint-disable */
import { z } from "zod";
import { ProductionSchedule, ScheduleAttendance } from "../production-scheduling/types";

export interface ChartDataPoint {
    date: string;
    target: number;
    actual: number;
    targetWorkers: number;
    actualWorkers: number;
}

export interface DashboardStats {
    totalWorkingPeople: number;
    totalSetWorkers: number;
    totalActualProduce: number;
    totalTargetProduce: number;
    productivityPercentage: number;
    chartData: ChartDataPoint[];
}

export const dashboardFilterSchema = z.object({
    startDate: z.string().min(1, "Start date is required"),
    endDate: z.string().min(1, "End date is required"),
    lineId: z.string().optional(),
});

export type DashboardFilter = z.infer<typeof dashboardFilterSchema>;
