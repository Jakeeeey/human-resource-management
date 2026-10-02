import type {
    DashboardBounds,
    QueueTile,
    QueueTone,
    RecruitmentDashboardData,
    StatusCount,
} from "../types";
import type {
    ApplicantRow,
    EvaluationRow,
    ManpowerRow,
    PipRow,
    RecommendationRow,
    TrackingRow,
} from "./rows";
import {
    APPLICANT_ROW_CAP,
} from "./queries";
import { dayKey } from "./dates";
import { buildProbation, countPendingAcknowledgement } from "./probation";
import { buildPositionBreakdown } from "./cohorts";
import { deriveRequestEffectiveStatus } from "@/modules/human-resource-management/recruitment/manpower-recommendation/utils/requestStatus";
import {
    isApplicantHired,
    isApplicantSlotOccupying,
} from "@/modules/human-resource-management/recruitment/manpower-recommendation/utils/applicantPipeline";

export type DashboardInput = {
    readonly applicantTotal: number;
    readonly applicantByStatus: readonly StatusCount[];
    readonly applicants: readonly ApplicantRow[];
    readonly manpowerRequests: readonly ManpowerRow[];
    readonly recommendations: readonly RecommendationRow[];
    readonly tracking: readonly TrackingRow[];
    readonly evaluations: readonly EvaluationRow[];
    readonly pips: readonly PipRow[];
};

type QueueSpec = {
    readonly key: string;
    readonly label: string;
    readonly href: string;
    readonly tone: QueueTone;
    readonly hint: string;
    readonly statuses: readonly string[];
};

const APPLICANT_QUEUES: readonly QueueSpec[] = [
    { key: "new", label: "New applicants", href: "/hrm/recruitment/applicants", tone: "info", hint: "Review and advance new applicants", statuses: ["draft", "submitted"] },
    { key: "quiz_ready", label: "Quiz cleared — schedule interview", href: "/hrm/recruitment/interviews", tone: "info", hint: "Book the initial interview", statuses: ["quiz_completed"] },
    { key: "initial", label: "For initial interview", href: "/hrm/recruitment/interviews", tone: "info", hint: "Run or decide the initial round", statuses: ["initial_interview", "verdict_pending"] },
    { key: "final", label: "Ready for final interview", href: "/hrm/recruitment/interviews?stage=Final", tone: "info", hint: "Run the final round", statuses: ["recommended", "final_interview"] },
    { key: "offer", label: "Final approved — create offer", href: "/hrm/recruitment/job-offer", tone: "attention", hint: "Create the job offer", statuses: ["final_approved"] },
    { key: "signing", label: "For signing",             href: "/hrm/recruitment/signing", tone: "attention", hint: "Collect signatures at the signing desk", statuses: ["for_signing"] },
    { key: "signing_done", label: "Signing complete — choose path", href: "/hrm/recruitment/onboarding", tone: "attention", hint: "Route to training or employment", statuses: ["signing_complete"] },
    { key: "training", label: "For training", href: "/hrm/recruitment/onboarding", tone: "info", hint: "Assign onboarding training", statuses: ["for_training"] },
    { key: "hired", label: "Hired — onboarding in progress", href: "/hrm/recruitment/onboarding", tone: "success", hint: "Complete the onboarding checklist", statuses: ["hired"] },
];

function shareOf(count: number, total: number): number | null {
    if (total <= 0) return null;
    return Math.round((count / total) * 1000) / 10;
}

export function buildDashboard(input: DashboardInput): RecruitmentDashboardData {
    const counts = new Map<string, number>();
    for (const row of input.applicantByStatus) counts.set(row.status, row.count);
    const at = (status: string): number => counts.get(status) ?? 0;
    const sum = (statuses: readonly string[]): number =>
        statuses.reduce((total, status) => total + at(status), 0);

    const volumeMap = new Map<string, number>();
    for (const applicant of input.applicants) {
        if (applicant.created_at === null || applicant.created_at === undefined) continue;
        const day = dayKey(applicant.created_at);
        if (day === null) continue;
        volumeMap.set(day, (volumeMap.get(day) ?? 0) + 1);
    }
    const volumeDaily = [...volumeMap.entries()]
        .map(([day, count]) => ({ day, count }))
        .sort((a, b) => (a.day < b.day ? -1 : 1));

    const probation = buildProbation(input.tracking, input.evaluations, input.pips);
    const probationCount = (status: string): number =>
        probation.byStatus.find((row) => row.status === status)?.count ?? 0;
    const applicantStatusById = new Map<number, string | null | undefined>(
        input.applicants.map((applicant) => [applicant.id, applicant.status])
    );
    let openManpowerRequests = 0;
    for (const request of input.manpowerRequests) {
        if ((request.status ?? "") !== "Approved") continue;
        let slotOccupying = 0;
        let hired = 0;
        for (const recommendation of input.recommendations) {
            if (recommendation.manpower_request_id !== request.id) continue;
            const status =
                recommendation.applicant_id == null
                    ? undefined
                    : applicantStatusById.get(recommendation.applicant_id);
            if (isApplicantSlotOccupying(status)) slotOccupying += 1;
            if (isApplicantHired(status)) hired += 1;
        }
        const effective = deriveRequestEffectiveStatus(request.status, request.no_manpower_needed ?? 0, {
            approved: slotOccupying,
            hired,
        });
        if (effective !== "Closed") openManpowerRequests += 1;
    }

    const applicantTiles: QueueTile[] = APPLICANT_QUEUES.map((spec) => {
        const count = sum(spec.statuses);
        return {
            key: spec.key,
            label: spec.label,
            count,
            href: spec.href,
            tone: spec.tone,
            hint: spec.hint,
            share: shareOf(count, input.applicantTotal),
        };
    });
    const queues: QueueTile[] = [
        ...applicantTiles,
        {
            key: "requisitions",
            label: "Open manpower requests",
            count: openManpowerRequests,
            href: "/hrm/recruitment/manpower-recommendation",
            tone: "neutral",
            hint: "Open the approved manpower requests",
            share: null,
        },
        {
            key: "regularization",
            label: "For regularization",
            count: probationCount("recommendation_issued"),
            href: "/hrm/performance-evaluation/admin-evaluation",
            tone: "attention",
            hint: "Act on the regularization recommendation",
            share: null,
        },
        {
            key: "termination_risk",
            label: "Subject to termination",
            count: probationCount("subject_to_termination"),
            href: "/hrm/performance-evaluation/admin-evaluation",
            tone: "danger",
            hint: "Review before termination takes effect",
            share: null,
        },
        {
            key: "pip",
            label: "PIP acknowledgement pending",
            count: countPendingAcknowledgement(input.pips),
            href: "/hrm/performance-evaluation/pip-acknowledgement",
            tone: "attention",
            hint: "Collect the employee acknowledgement",
            share: null,
        },
    ];

    const bounds: DashboardBounds = {
        applicantRowsScanned: input.applicants.length,
        applicantRowCap: APPLICANT_ROW_CAP,
    };
    return {
        generatedAt: new Date().toISOString(),
        totalApplicants: input.applicantTotal,
        queues,
        volumeDaily,
        volumeStart: volumeDaily.length > 0 ? volumeDaily[0]?.day ?? null : null,
        volumeEnd: volumeDaily.length > 0 ? volumeDaily[volumeDaily.length - 1]?.day ?? null : null,
        probation,
        breakdown: buildPositionBreakdown(input.applicants),
        bounds,
    };
}
