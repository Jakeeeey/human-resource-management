"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useInterview } from "../hooks/useInterview";
import { Interview } from "../types";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { FileText, Loader2 } from "lucide-react";
import { formatDateLong } from "@/lib/utils";

type InterviewVerdict = "Pending" | "Passed" | "Failed";

const VERDICT_OPTIONS: InterviewVerdict[] = ["Pending", "Passed", "Failed"];

/**
 * Client-side score-sheet item snapshot for the per-criterion breakdown.
 * Client-safe copy of the server SheetItem shape — the service layer must
 * never be imported into client code.
 */
interface ClientSheetItem {
    id: number;
    criterion_name_snapshot: string;
    weight_percentage_snapshot: number;
    is_quiz_criterion: boolean;
    score: number;
    sort: number;
}

/**
 * Stage pill colors copied verbatim from the manpower status map
 * (ManpowerRequestDetail getStatusColor): Initial blue, Final purple.
 * @param stage - Interview stage.
 * @returns Pill color classes for the stage.
 */
function getStageColor(stage: string) {
    switch (stage) {
        case "Initial": return "bg-blue-500/10 text-blue-600 border-blue-500/20";
        case "Final": return "bg-purple-500/10 text-purple-600 border-purple-500/20";
        default: return "bg-primary/10 text-primary border-primary/20";
    }
}

/**
 * Verdict pill colors copied verbatim from VerdictChip
 * (InterviewEligibleList): Passed emerald / Failed red / Pending amber.
 * @param verdict - Interview verdict.
 * @returns Pill color classes for the verdict.
 */
function getVerdictColor(verdict: string) {
    switch (verdict) {
        case "Passed": return "bg-emerald-500/10 text-emerald-600 border-emerald-500/20";
        case "Failed": return "bg-red-500/10 text-red-600 border-red-500/20";
        case "Pending": return "bg-amber-500/10 text-amber-600 border-amber-500/20";
        default: return "bg-zinc-500/10 text-zinc-600 border-zinc-500/20";
    }
}

/**
 * Weighted-average composite guideline: SUM(score * weight) / 100, 2-dec.
 * Display only — the verdict stays manual and never follows this score.
 * @param items - Criterion snapshots with score + weight percentage.
 * @returns Composite score rounded to 2 decimals.
 */
function computeComposite(items: Pick<ClientSheetItem, "score" | "weight_percentage_snapshot">[]): number {
    const total = items.reduce((sum, item) => sum + item.score * item.weight_percentage_snapshot, 0);
    return Math.round((total / 100) * 100) / 100;
}

/**
 * Per-application interview history dialog (latest-first, latest wins).
 *
 * Opened via handleView (useInterview) from the eligible-list History action.
 * Every interview for the selected application renders newest first: stage
 * badge + verdict badge (manpower-family pills), composite, interviewer
 * (users map with `User #id` fallback), date, per-criterion breakdown
 * (sheet items fetched per score_sheet_id), and notes. The newest interview
 * is ring-emphasized (blue outline). The verdict change control below
 * it is MANUAL-ONLY (mirrors the View inline Select pattern: badge preview
 * + save via PATCH) — HR may Pass a subpar grade, so the verdict is never
 * derived from the composite.
 */
export function InterviewDetail() {
    const { selectedInterview, setSelectedInterview, interviews, updateInterview, userDisplay } = useInterview();
    const router = useRouter();
    const applicationId = selectedInterview?.application_id ?? null;

    const history: Interview[] = useMemo(() => {
        if (applicationId == null) return [];
        return interviews.filter((interview) => interview.application_id === applicationId);
    }, [interviews, applicationId]);

    const latest = history[0] ?? null;

    const [itemsBySheet, setItemsBySheet] = useState<Record<number, ClientSheetItem[]>>({});
    const [itemsLoading, setItemsLoading] = useState(false);
    const [newVerdict, setNewVerdict] = useState<InterviewVerdict>("Pending");
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        setNewVerdict((latest?.verdict as InterviewVerdict | undefined) ?? "Pending");
    }, [latest]);

    useEffect(() => {
        if (applicationId == null) {
            setItemsBySheet({});
            return;
        }
        const sheetIds = history
            .map((interview) => interview.score_sheet_id)
            .filter((id): id is number => id != null);
        const unique = [...new Set(sheetIds)];
        if (unique.length === 0) return;
        let cancelled = false;
        setItemsLoading(true);
        Promise.all(
            unique.map(async (sheetId) => {
                try {
                    const response = await fetch(`/api/hrm/interviews/sheets/${sheetId}/items`);
                    if (!response.ok) return { sheetId, items: [] as ClientSheetItem[] };
                    const json = await response.json();
                    return { sheetId, items: (Array.isArray(json.data) ? json.data : []) as ClientSheetItem[] };
                } catch {
                    return { sheetId, items: [] as ClientSheetItem[] };
                }
            }),
        ).then((entries) => {
            if (cancelled) return;
            setItemsBySheet(Object.fromEntries(entries.map((entry) => [entry.sheetId, entry.items])));
            setItemsLoading(false);
        });
        return () => {
            cancelled = true;
        };
    }, [applicationId, history]);

    /**
     * Save the manually chosen verdict for the latest interview via PATCH.
     * Sends ONLY { verdict } — updated_at/updated_by are stamped server-side
     * (nowPH + JWT), the client stamps no timestamps.
     * A Passed Initial verdict continues the hiring chain in manpower
     * recommendation — do not remove this navigation (mirrors grade page).
     */
    const handleSaveVerdict = async () => {
        if (latest?.id == null) return;
        setIsSaving(true);
        try {
            await updateInterview(latest.id, { verdict: newVerdict });
            if (latest.stage === "Initial" && newVerdict === "Passed") router.push("/hrm/manpower-recommendation");
        } finally {
            setIsSaving(false);
        }
    };

    if (!selectedInterview) return null;

    return (
        <Dialog open={selectedInterview != null} onOpenChange={(open) => { if (!open) setSelectedInterview(null); }}>
            <DialogContent className="w-[95vw] sm:max-w-[750px] p-0 overflow-hidden border border-border/40 shadow-2xl bg-background rounded-2xl flex flex-col max-h-[90vh]">
                <div className="p-6 border-b border-border/40 bg-card">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-extrabold flex items-center gap-3">
                            <FileText className="w-6 h-6 text-primary" />
                            <span className="truncate">Interview History — Application #{applicationId}</span>
                        </DialogTitle>
                        <DialogDescription className="text-sm mt-2">
                            {history.length} {history.length === 1 ? "grading" : "gradings"}, newest first. The latest grading wins.
                        </DialogDescription>
                    </DialogHeader>
                </div>

                <div className="p-6 flex-1 overflow-y-auto min-h-0">
                    {history.length === 0 ? (
                        <div className="flex flex-col items-center justify-center text-muted-foreground text-center h-24">
                            <FileText className="w-12 h-12 text-muted-foreground/30 mb-3" />
                            <p className="font-medium">No interviews yet for this application.</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {history.map((interview, index) => {
                                const isLatest = index === 0;
                                const items = interview.score_sheet_id != null ? itemsBySheet[interview.score_sheet_id] ?? null : null;
                                const composite = items && items.length > 0 ? computeComposite(items) : null;
                                const interviewerName = interview.interviewed_by == null
                                    ? "-"
                                    : userDisplay(interview.interviewed_by) || `User #${interview.interviewed_by}`;
                                return (
                                    <div key={interview.id} className={`p-4 border rounded-xl bg-card space-y-3 ${isLatest ? "border-primary/40 ring-1 ring-primary/20" : "border-border/50"}`}>
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className={`px-3 py-1.5 border text-xs rounded-full font-bold uppercase tracking-wider ${getStageColor(interview.stage)}`}>
                                                {interview.stage}
                                            </span>
                                            <span className={`px-3 py-1.5 border text-xs rounded-full font-bold uppercase tracking-wider ${getVerdictColor(interview.verdict)}`}>
                                                {interview.verdict}
                                            </span>
                                            <span className="ml-auto text-sm text-muted-foreground">
                                                Composite: <span className="font-bold text-foreground">{composite != null ? composite.toFixed(2) : itemsLoading ? "…" : "-"}</span>
                                            </span>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                                            <div>
                                                <span className="text-xs font-bold uppercase text-muted-foreground block mb-1">Interviewer</span>
                                                <div className="font-medium text-foreground p-2 bg-muted/30 rounded-md border border-border/50 truncate" title={interviewerName}>{interviewerName}</div>
                                            </div>
                                            <div>
                                                <span className="text-xs font-bold uppercase text-muted-foreground block mb-1">Date</span>
                                                <div className="font-medium text-foreground p-2 bg-muted/30 rounded-md border border-border/50">{(() => { const raw = interview.interviewed_at ?? interview.created_at; return raw ? formatDateLong(new Date(raw)) : "-"; })()}</div>
                                            </div>
                                        </div>
                                        <div>
                                            <span className="text-xs font-bold uppercase text-muted-foreground block mb-1">Per-criterion breakdown</span>
                                            {items == null ? (
                                                <div className="text-sm text-muted-foreground p-2">{itemsLoading ? "Loading criteria…" : interview.score_sheet_id == null ? "No score sheet." : "No criteria found."}</div>
                                            ) : items.length === 0 ? (
                                                <div className="text-sm text-muted-foreground p-2">No criteria found.</div>
                                            ) : (
                                                <div className="border border-border/50 rounded-md overflow-hidden">
                                                    {items.map((item) => (
                                                        <div key={item.id} className="flex items-center gap-2 px-3 py-2 text-sm border-b border-border/50 last:border-b-0 bg-muted/20">
                                                            <span className="truncate flex-1 min-w-0" title={item.criterion_name_snapshot}>
                                                                {item.criterion_name_snapshot}
                                                                {item.is_quiz_criterion ? " (quiz)" : ""}
                                                            </span>
                                                            <span className="text-muted-foreground shrink-0">w {item.weight_percentage_snapshot}%</span>
                                                            <span className="font-bold shrink-0 w-14 text-right">{item.score}</span>
                                                        </div>
                                                    ))}
                                                    <div className="flex items-center gap-2 px-3 py-2 text-sm bg-muted/40 border-t border-border/50 font-bold">
                                                        <span className="flex-1">Total</span>
                                                        <span className="shrink-0 w-14 text-right">{composite != null ? composite.toFixed(2) : "-"}</span>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                        <div>
                                            <span className="text-xs font-bold uppercase text-muted-foreground block mb-1">Notes</span>
                                            <div className="font-medium text-foreground p-2 bg-muted/30 rounded-md border border-border/50 whitespace-pre-wrap break-words text-sm">{interview.notes || "-"}</div>
                                        </div>
                                        {/* Passed verdicts are final and can no longer be changed. */}
                                        {isLatest && latest?.verdict !== "Passed" && (
                                            <div className="flex items-center gap-2 pt-1 border-t border-border/50">
                                                <span className="text-xs font-bold uppercase text-muted-foreground">Verdict</span>
                                                <Select value={newVerdict} onValueChange={(v) => setNewVerdict(v as InterviewVerdict)}>
                                                    <SelectTrigger className="truncate w-[160px]">
                                                        <SelectValue placeholder="Select verdict" className="truncate" />
                                                    </SelectTrigger>
                                                    <SelectContent className="max-h-60">
                                                        {VERDICT_OPTIONS.map((option) => (
                                                            <SelectItem key={option} value={option}>
                                                                {option}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                <Button onClick={handleSaveVerdict} disabled={isSaving || newVerdict === latest?.verdict} size="sm" className="ml-auto">
                                                    {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                                    Save verdict
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                <div className="p-4 md:p-6 bg-muted/20 border-t border-border/40">
                    <DialogFooter className="flex w-full sm:justify-end gap-3 items-center">
                        <DialogClose asChild>
                            <Button type="button" variant="outline" className="rounded-full px-6">
                                Close
                            </Button>
                        </DialogClose>
                    </DialogFooter>
                </div>
            </DialogContent>
        </Dialog>
    );
}
