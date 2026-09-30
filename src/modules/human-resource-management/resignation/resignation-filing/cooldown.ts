import type { ResignationStatus } from "./types";
import { parseUtcInstant } from "@/modules/human-resource-management/shared/utils/time";

export const RESIGNATION_COOLDOWN_DAYS = 30;

export interface ResignationEligibilityRow {
    status: ResignationStatus;
    reviewed_at: string | null;
}

export type ResignationEligibility =
    | { canFile: true; reason: null; nextAllowedAt: null }
    | { canFile: false; reason: "pending" | "approved" | "cooling_down"; nextAllowedAt: string | null };

export function evaluateResignationEligibility(rows: readonly ResignationEligibilityRow[], now: string): ResignationEligibility {
    const hasPending = rows.some((row) => row.status === "pending");
    if (hasPending) {
        return { canFile: false, reason: "pending", nextAllowedAt: null };
    }
    const hasApproved = rows.some((row) => row.status === "approved");
    if (hasApproved) {
        return { canFile: false, reason: "approved", nextAllowedAt: null };
    }
    const rejectedInstants: Date[] = [];
    for (const row of rows) {
        if (row.status !== "rejected") {
            continue;
        }
        if (row.reviewed_at === null) {
            continue;
        }
        const parsed = parseUtcInstant(row.reviewed_at);
        if (parsed !== null) {
            rejectedInstants.push(parsed);
        }
    }
    if (rejectedInstants.length === 0) {
        return { canFile: true, reason: null, nextAllowedAt: null };
    }
    let latest = rejectedInstants[0];
    for (let index = 1; index < rejectedInstants.length; index++) {
        if (rejectedInstants[index].getTime() > latest.getTime()) {
            latest = rejectedInstants[index];
        }
    }
    const nowInstant = parseUtcInstant(now);
    if (nowInstant === null) {
        return { canFile: true, reason: null, nextAllowedAt: null };
    }
    const cooldownMs = RESIGNATION_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;
    const nextAllowed = new Date(latest.getTime() + cooldownMs);
    if (nowInstant.getTime() < nextAllowed.getTime()) {
        return {
            canFile: false,
            reason: "cooling_down",
            nextAllowedAt: nextAllowed.toISOString().replace(/\.\d{3}Z$/, "Z"),
        };
    }
    return { canFile: true, reason: null, nextAllowedAt: null };
}
