export type PipStatus = "open" | "passed" | "failed";

export type PipPhase = "unacknowledged" | "ready_for_review" | "passed" | "failed";

export interface PipGuardFacts {
  status: PipStatus;
  employeeAcknowledgedAt: string | null;
}

export interface PipPlanOutcome {
  reviewDate: string | null;
  result: string | null;
}

export function derivePipPhase(pip: PipGuardFacts): PipPhase {
  if (pip.status === "passed") return "passed";
  if (pip.status === "failed") return "failed";
  return pip.employeeAcknowledgedAt === null ? "unacknowledged" : "ready_for_review";
}

export function isPlanEditable(pip: PipGuardFacts): boolean {
  return pip.status === "open" && pip.employeeAcknowledgedAt === null;
}

export function canRecordOutcome(pip: PipGuardFacts): boolean {
  return pip.status === "open" && pip.employeeAcknowledgedAt !== null;
}

function isBlank(value: string | null): boolean {
  return value === null || value.trim() === "";
}

export function incompleteOutcomeIndices(
  rows: readonly PipPlanOutcome[]
): number[] {
  const missing: number[] = [];
  rows.forEach((row, index) => {
    if (isBlank(row.reviewDate) || isBlank(row.result)) missing.push(index);
  });
  return missing;
}

export function reviewDateInRange(
  reviewDate: string | null,
  startDate: string | null,
  endDate: string | null
): boolean {
  if (reviewDate === null || reviewDate.trim() === "") return true;
  const day = reviewDate.trim().slice(0, 10);
  const start =
    startDate === null || startDate.trim() === ""
      ? null
      : startDate.trim().slice(0, 10);
  const end =
    endDate === null || endDate.trim() === ""
      ? null
      : endDate.trim().slice(0, 10);
  if (start !== null && day < start) return false;
  if (end !== null && day > end) return false;
  return true;
}
