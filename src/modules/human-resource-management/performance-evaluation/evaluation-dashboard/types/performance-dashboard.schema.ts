export interface PerformanceDashboardKpis {
    total: number;
    evaluated_count: number;
    avg_score: number | null;
    avg_score_band: string | null;
    probation_count: number;
    high_performer_pct: number | null;
    attention_count: number;
}

export interface PerformanceDashboardTrendPoint {
    period: string;
    avg_score: number | null;
    count: number;
}

export interface PerformanceDashboardDepartment {
    department_id: number | null;
    department_name: string;
    avg_score: number | null;
    count: number;
    high_performer_pct: number | null;
}

export interface PerformanceDashboardBandCount {
    band: string;
    count: number;
}

export interface PerformanceDashboardBinCount {
    bin: string;
    count: number;
}

export interface PerformanceDashboardPerformer {
    user_id: number;
    name: string;
    department_name: string | null;
    score: number;
    band: string;
}

export interface PerformanceDashboardAttention {
    user_id: number;
    name: string;
    department_name: string | null;
    status: string;
    reason: string;
}

export interface PerformanceDashboardPips {
    open: number;
    passed: number;
    failed: number;
}

export interface PerformanceDashboardBundle {
    generated_at: string;
    scope: "hr" | "head";
    kpis: PerformanceDashboardKpis;
    trend: PerformanceDashboardTrendPoint[];
    by_department: PerformanceDashboardDepartment[];
    rating_distribution: PerformanceDashboardBandCount[];
    score_distribution: PerformanceDashboardBinCount[];
    top_performers: PerformanceDashboardPerformer[];
    needs_attention: PerformanceDashboardAttention[];
    pips: PerformanceDashboardPips;
}
