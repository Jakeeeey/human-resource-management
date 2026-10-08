import type { ClearanceRequestStatus } from "../types";

export interface ClearanceDashboardKpis {
    total: number;
    completed_count: number;
    in_progress_count: number;
    not_started_count: number;
    completion_rate: number | null;
    avg_days_to_confirm: number | null;
    stale_open_count: number;
}

export interface ClearanceDashboardTrendPoint {
    period: string;
    count: number;
}

export interface ClearanceDashboardTemplateRow {
    template_id: number;
    template_title: string;
    total: number;
    completed: number;
}

export interface ClearanceDashboardStatusSlice {
    status: ClearanceRequestStatus;
    count: number;
}

export interface ClearanceDashboardAgingBin {
    bin: string;
    count: number;
}

export interface ClearanceDashboardOldestOpen {
    request_id: number;
    employee_name: string;
    template_title: string;
    days_open: number;
    status: ClearanceRequestStatus;
    created_at: string | null;
}

export interface ClearanceDashboardBundle {
    generated_at: string;
    scope: "hr" | "head";
    stale_after_days: number;
    kpis: ClearanceDashboardKpis;
    trend: ClearanceDashboardTrendPoint[];
    trend_avg: number | null;
    by_template: ClearanceDashboardTemplateRow[];
    status_mix: ClearanceDashboardStatusSlice[];
    aging: ClearanceDashboardAgingBin[];
    oldest_open: ClearanceDashboardOldestOpen[];
    oldest_open_total: number;
}
