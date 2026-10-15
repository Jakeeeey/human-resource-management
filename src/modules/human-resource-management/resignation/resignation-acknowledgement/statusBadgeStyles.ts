import type { ResignationStatus } from "./types";

export const RESIGNATION_STATUS_BADGE_STYLES: Record<ResignationStatus, string> = {
    pending: "bg-amber-500/10 text-amber-700 border-amber-500/30",
    approved: "bg-green-600/10 text-green-700 border-green-600/30",
    clearance_ongoing: "bg-blue-600/10 text-blue-700 border-blue-600/30",
    cleared: "bg-emerald-600/10 text-emerald-700 border-emerald-600/30",
    rejected: "bg-rose-600/10 text-rose-700 border-rose-600/30",
    withdrawn: "bg-muted text-muted-foreground border-border",
};
