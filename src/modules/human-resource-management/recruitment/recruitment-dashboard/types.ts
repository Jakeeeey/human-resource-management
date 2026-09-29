export const GRANULARITIES = ["day", "week", "month"] as const;
export type Granularity = (typeof GRANULARITIES)[number];

export const PROBATION_STATUSES = [
    "probationary",
    "pip_open",
    "recommendation_issued",
    "subject_to_termination",
    "regular",
    "terminated",
] as const;
export type ProbationStatus = (typeof PROBATION_STATUSES)[number];

export type StatusCount = {
    readonly status: string;
    readonly count: number;
};

export type DayBucket = {
    readonly day: string;
    readonly count: number;
};

export const QUEUE_TONES = ["info", "attention", "success", "danger", "neutral"] as const;
export type QueueTone = (typeof QUEUE_TONES)[number];

export type QueueTile = {
    readonly key: string;
    readonly label: string;
    readonly count: number;
    readonly href: string;
    readonly tone: QueueTone;
    readonly hint: string;
    readonly share: number | null;
};

export type ProbationSummary = {
    readonly byStatus: readonly StatusCount[];
    readonly tracked: number;
};

export type PositionBreakdown = {
    readonly applicantsByPosition: readonly StatusCount[];
};

export type DashboardBounds = {
    readonly applicantRowsScanned: number;
    readonly applicantRowCap: number;
};

export type RecruitmentDashboardData = {
    readonly generatedAt: string;
    readonly totalApplicants: number;
    readonly queues: readonly QueueTile[];
    readonly volumeDaily: readonly DayBucket[];
    readonly volumeStart: string | null;
    readonly volumeEnd: string | null;
    readonly probation: ProbationSummary;
    readonly breakdown: PositionBreakdown;
    readonly bounds: DashboardBounds;
};
