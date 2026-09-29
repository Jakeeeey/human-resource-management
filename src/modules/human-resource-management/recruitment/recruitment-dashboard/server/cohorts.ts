import type {
    PositionBreakdown,
    StatusCount,
} from "../types";
import type {
    ApplicantRow,
} from "./rows";
import { norm } from "./dates";

export function buildPositionBreakdown(
    applicants: readonly ApplicantRow[]
): PositionBreakdown {
    const positionTally = new Map<string, number>();
    for (const applicant of applicants) {
        const position = norm(applicant.position_applied_for) ?? "Unspecified";
        positionTally.set(position, (positionTally.get(position) ?? 0) + 1);
    }
    const applicantsByPosition: StatusCount[] = [...positionTally.entries()]
        .map(([status, count]) => ({ status, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);
    return { applicantsByPosition };
}
