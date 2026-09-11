"use client";

import { useState } from "react";
import Link from "next/link";
import { useInterview } from "../hooks/useInterview";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Eye, FileText, Pencil } from "lucide-react";

/**
 * Tabbed eligible list for applicant interview grading.
 *
 * Initial tab rows quiz-completed applications (applicant, quiz score +
 * passed/failed badge, latest initial verdict chip); Final tab rows recommended
 * recommendations (request ref, applicant, latest final verdict
 * chip). Grade renders as a link to
 * `/hrm/interviews/grade/[id]` ONLY when an ungraded (sheet-less) interview
 * exists for that row — otherwise the actions cell shows History only.
 * History selects the latest
 * interview via handleView for the detail dialog.
 *
 * Search filters through the hook joined-text lists (filteredInitial /
 * filteredFinal); the verdict dropdown filters the active tab by verdict
 * (All, Pending, Passed, Failed). Applicant names arrive as full_name per row from
 * the T4 envelope applicant lookup, with `Applicant #id` fallback only
 * when the name is truly missing.
 */
export function InterviewEligibleList() {
    const {
        interviews,
        filteredInitial,
        filteredFinal,
        isLoading,
        error,
        stageTab,
        setStageTab,
        searchQuery,
        setSearchQuery,
        handleView,
        latestPerApplication,
    } = useInterview();
    const [verdictFilter, setVerdictFilter] = useState<"All" | "Pending" | "Passed" | "Failed">("All");
    const [pageInitial, setPageInitial] = useState(1);
    const [pageFinal, setPageFinal] = useState(1);

    if (error) {
        return <div className="p-4 text-red-500 bg-red-50 rounded-lg">Error: {error}</div>;
    }

    const visibleInitial =
        verdictFilter === "All" ? filteredInitial : filteredInitial.filter((row) => row.latestInitialVerdict === verdictFilter);
    const visibleFinal =
        verdictFilter === "All" ? filteredFinal : filteredFinal.filter((row) => row.latestFinalVerdict === verdictFilter);

    const PAGE_SIZE = 10;
    const totalPagesInitial = Math.max(1, Math.ceil(visibleInitial.length / PAGE_SIZE));
    const totalPagesFinal = Math.max(1, Math.ceil(visibleFinal.length / PAGE_SIZE));
    const safePageInitial = Math.min(pageInitial, totalPagesInitial);
    const safePageFinal = Math.min(pageFinal, totalPagesFinal);
    const pagedInitial = visibleInitial.slice((safePageInitial - 1) * PAGE_SIZE, safePageInitial * PAGE_SIZE);
    const pagedFinal = visibleFinal.slice((safePageFinal - 1) * PAGE_SIZE, safePageFinal * PAGE_SIZE);

    const filtersActive = searchQuery.trim() !== "" || verdictFilter !== "All";

    const clearFilters = () => {
        setSearchQuery("");
        setVerdictFilter("All");
        setPageInitial(1);
        setPageFinal(1);
    };

    /**
     * Contextual empty-state copy: echoes the active search/verdict so the user
     * can tell "nothing exists" from "my filter excluded everything".
     * @param noun - Pluralised subject of the sentence.
     * @param fallback - Copy for a genuinely empty dataset.
     * @returns Empty-state sentence for the active filter state.
     */
    const emptyMessage = (noun: string, fallback: string): string => {
        const query = searchQuery.trim();
        if (query && verdictFilter !== "All") return `No ${noun} match “${query}” with a ${verdictFilter} verdict.`;
        if (query) return `No ${noun} match “${query}”.`;
        if (verdictFilter !== "All") return `No ${noun} with a ${verdictFilter} verdict.`;
        return fallback;
    };

    /**
     * Ungraded (sheet-less) Initial interview for an application — the only
     * state that renders a Grade link on the Initial tab.
     */
    const ungradedInitialFor = (applicationId: number) =>
        interviews.find(
            (interview) =>
                interview.application_id === applicationId &&
                interview.stage === "Initial" &&
                interview.score_sheet_id == null,
        ) ?? null;

    /**
     * Ungraded (sheet-less) Final interview for a recommendation — the only
     * state that renders a Grade link on the Final tab.
     */
    const ungradedFinalFor = (recommendationId: number) =>
        interviews.find(
            (interview) =>
                interview.stage === "Final" &&
                interview.recommendation_id === recommendationId &&
                interview.score_sheet_id == null,
        ) ?? null;

    const handleHistoryInitial = (applicationId: number) => {
        const latest = latestPerApplication(applicationId);
        if (latest) handleView(latest);
    };

    const handleHistoryFinal = (recommendationId: number) => {
        const latest = interviews.find((interview) => interview.recommendation_id === recommendationId) ?? null;
        if (latest) handleView(latest);
    };

    return (
        <div className="space-y-4">
            <Tabs
                value={stageTab}
                onValueChange={(value) => {
                    setStageTab(value as "Initial" | "Final");
                    setVerdictFilter("All");
                    setPageInitial(1);
                    setPageFinal(1);
                }}
            >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <TabsList aria-label="Interview stage" className="w-full sm:w-auto">
                        <TabsTrigger value="Initial" className="flex-1 sm:flex-none">
                            Initial
                            <span className="ml-2 rounded-full bg-blue-500/10 text-blue-600 border border-blue-500/20 px-2.5 py-0.5 text-xs font-bold">
                                {filteredInitial.length}
                            </span>
                        </TabsTrigger>
                        <TabsTrigger value="Final" className="flex-1 sm:flex-none">
                            Final
                            <span className="ml-2 rounded-full bg-blue-500/10 text-blue-600 border border-blue-500/20 px-2.5 py-0.5 text-xs font-bold">
                                {filteredFinal.length}
                            </span>
                        </TabsTrigger>
                    </TabsList>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                        <Input
                            placeholder={stageTab === "Initial" ? "Search by applicant name..." : "Search by name or position..."}
                            value={searchQuery}
                            onChange={(e) => {
                                setSearchQuery(e.target.value);
                                setPageInitial(1);
                                setPageFinal(1);
                            }}
                            className="w-full sm:w-64"
                        />
                        <Select
                            value={verdictFilter}
                            onValueChange={(value) => {
                                setVerdictFilter(value as "All" | "Pending" | "Passed" | "Failed");
                                setPageInitial(1);
                                setPageFinal(1);
                            }}
                        >
                            <SelectTrigger className="w-full sm:w-40" aria-label="Filter by verdict">
                                <SelectValue placeholder="All verdicts" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="All">All verdicts</SelectItem>
                                <SelectItem value="Pending">Pending</SelectItem>
                                <SelectItem value="Passed">Passed</SelectItem>
                                <SelectItem value="Failed">Failed</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </Tabs>
            {stageTab === "Initial" ? (
                <div className="bg-card border border-border/50 rounded-2xl overflow-hidden shadow-sm">
                    <div className="hidden overflow-x-auto sm:block">
                    <Table className="min-w-[760px]">
                        <TableHeader className="bg-muted/30">
                            <TableRow className="hover:bg-transparent border-border/50">
                                <TableHead className="font-bold text-xs uppercase tracking-wider text-muted-foreground pl-6 h-14">Applicant</TableHead>
                                <TableHead className="font-bold text-xs uppercase tracking-wider text-muted-foreground h-14 text-center">Quiz Score</TableHead>
                                <TableHead className="font-bold text-xs uppercase tracking-wider text-muted-foreground h-14 text-center">Quiz Result</TableHead>
                                <TableHead className="font-bold text-xs uppercase tracking-wider text-muted-foreground h-14 text-center">Interview Score</TableHead>
                                <TableHead className="font-bold text-xs uppercase tracking-wider text-muted-foreground h-14 text-center">Initial Verdict</TableHead>
                                <TableHead className="font-bold text-xs uppercase tracking-wider text-muted-foreground h-14 text-right pr-6">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center h-48">
                                        <div className="flex flex-col items-center justify-center text-muted-foreground">
                                            <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin mb-4"></div>
                                            <p className="font-medium animate-pulse">Loading eligible applications...</p>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : visibleInitial.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center h-48">
                                        <div className="flex flex-col items-center justify-center text-muted-foreground gap-2">
                                            <FileText className="w-12 h-12 text-muted-foreground/30" />
                                            <p className="font-medium">{emptyMessage("applications", "No quiz-completed applications.")}</p>
                                            {filtersActive && (
                                                <Button variant="outline" size="sm" onClick={clearFilters}>Clear filters</Button>
                                            )}
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                pagedInitial.map((row) => {
                                    const ungraded = ungradedInitialFor(row.id);
                                    // Attempt-derived quiz result: the live attempt row wins; the
                                    // application columns are its synced mirror (quiz-attempt
                                    // write-back), used only when no attempt exists.
                                    const quizScore = row.quiz_attempt_percentage ?? row.quiz_score;
                                    const quizPassed = row.quiz_attempt_id != null ? row.quiz_attempt_passed : row.quiz_passed;
                                    return (
                                    <TableRow key={row.id} className="hover:bg-muted/40 transition-colors border-border/50 group">
                                        <TableCell className="pl-6 h-16">
                                            <div className="font-bold text-foreground group-hover:text-primary transition-colors max-w-[300px] truncate" title={row.full_name || `Applicant #${row.applicant_id}`}>
                                                {row.full_name || `Applicant #${row.applicant_id}`}
                                            </div>
                                        </TableCell>
                                        <TableCell className="font-medium text-muted-foreground/80 text-center">
                                            {quizScore ?? "—"}
                                        </TableCell>
                                        <TableCell className="text-center">
                                            {quizPassed === true ? (
                                                <span className="px-3 py-1.5 border text-xs rounded-full font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-600 border-emerald-500/20 inline-block w-[110px] text-center">
                                                    Passed
                                                </span>
                                            ) : quizPassed === false ? (
                                                <span className="px-3 py-1.5 border text-xs rounded-full font-bold uppercase tracking-wider bg-red-500/10 text-red-600 border-red-500/20 inline-block w-[110px] text-center">
                                                    Failed
                                                </span>
                                            ) : (
                                                <span className="px-3 py-1.5 border text-xs rounded-full font-bold uppercase tracking-wider bg-zinc-500/10 text-zinc-600 border-zinc-500/20 inline-block w-[110px] text-center">
                                                    No quiz
                                                </span>
                                            )}
                                        </TableCell>
                                        <TableCell className="font-medium text-muted-foreground/80 text-center">
                                            {row.latestComposite != null ? Number(row.latestComposite).toFixed(2) : "—"}
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <VerdictChip verdict={row.latestInitialVerdict} />
                                        </TableCell>
                                        <TableCell className="pr-6 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                {ungraded && (
                                                    <Button variant="ghost" size="sm" asChild>
                                                        <Link href={`/hrm/interviews/grade/${ungraded.id}`} aria-label={`Grade application ${row.id}`}>
                                                            <Pencil className="mr-2 h-4 w-4 text-muted-foreground" />
                                                            Grade
                                                        </Link>
                                                    </Button>
                                                )}
                                                <Button variant="ghost" size="sm" onClick={() => handleHistoryInitial(row.id)} aria-label={`View history for application ${row.id}`}>
                                                    <Eye className="mr-2 h-4 w-4 text-muted-foreground" />
                                                    History
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                    );
                                })
                            )}
                        </TableBody>
                    </Table>
                    </div>
                    {/* Mobile: stacked cards so verdict + Grade/History stay reachable at narrow widths */}
                    <div className="space-y-3 p-3 sm:hidden">
                        {isLoading ? (
                            <div className="flex flex-col items-center justify-center text-muted-foreground h-32">
                                <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin mb-4"></div>
                                <p className="font-medium animate-pulse">Loading eligible applications...</p>
                            </div>
                        ) : pagedInitial.length === 0 ? (
                            <div className="flex flex-col items-center justify-center text-muted-foreground text-center gap-2 py-8">
                                <FileText className="w-12 h-12 text-muted-foreground/30" />
                                <p className="font-medium">{emptyMessage("applications", "No quiz-completed applications.")}</p>
                                {filtersActive && (
                                    <Button variant="outline" size="sm" onClick={clearFilters}>Clear filters</Button>
                                )}
                            </div>
                        ) : (
                            pagedInitial.map((row) => {
                                const ungraded = ungradedInitialFor(row.id);
                                const quizScore = row.quiz_attempt_percentage ?? row.quiz_score;
                                const quizPassed = row.quiz_attempt_id != null ? row.quiz_attempt_passed : row.quiz_passed;
                                return (
                                    <div key={row.id} className="rounded-xl border border-border/60 p-4 space-y-3">
                                        <div className="min-w-0">
                                            <p className="font-bold text-foreground truncate" title={row.full_name || `Applicant #${row.applicant_id}`}>
                                                {row.full_name || `Applicant #${row.applicant_id}`}
                                            </p>
                                            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                                                <span>Quiz: <span className="font-semibold text-foreground">{quizScore ?? "—"}</span></span>
                                                <span>Result: <span className="font-semibold text-foreground">{quizPassed === true ? "Passed" : quizPassed === false ? "Failed" : "No quiz"}</span></span>
                                                <span>Interview: <span className="font-semibold text-foreground">{row.latestComposite != null ? Number(row.latestComposite).toFixed(2) : "—"}</span></span>
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between gap-2">
                                            <VerdictChip verdict={row.latestInitialVerdict} />
                                            <div className="flex items-center gap-1">
                                                {ungraded && (
                                                    <Button variant="ghost" size="sm" asChild>
                                                        <Link href={`/hrm/interviews/grade/${ungraded.id}`} aria-label={`Grade application ${row.id}`}>
                                                            <Pencil className="mr-1.5 h-4 w-4 text-muted-foreground" />
                                                            Grade
                                                        </Link>
                                                    </Button>
                                                )}
                                                <Button variant="ghost" size="sm" onClick={() => handleHistoryInitial(row.id)} aria-label={`View history for application ${row.id}`}>
                                                    <Eye className="mr-1.5 h-4 w-4 text-muted-foreground" />
                                                    History
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                    <Pager
                        page={safePageInitial}
                        totalPages={totalPagesInitial}
                        total={visibleInitial.length}
                        onChange={setPageInitial}
                    />
                </div>
            ) : (
                <div className="bg-card border border-border/50 rounded-2xl overflow-hidden shadow-sm">
                    <div className="hidden overflow-x-auto sm:block">
                    <Table className="min-w-[560px]">
                        <TableHeader className="bg-muted/30">
                            <TableRow className="hover:bg-transparent border-border/50">
                                <TableHead className="font-bold text-xs uppercase tracking-wider text-muted-foreground pl-6 h-14">Position</TableHead>
                                <TableHead className="font-bold text-xs uppercase tracking-wider text-muted-foreground h-14">Applicant</TableHead>
                                <TableHead className="font-bold text-xs uppercase tracking-wider text-muted-foreground h-14 text-center">Final Verdict</TableHead>
                                <TableHead className="font-bold text-xs uppercase tracking-wider text-muted-foreground h-14 text-right pr-6">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={4} className="text-center h-48">
                                        <div className="flex flex-col items-center justify-center text-muted-foreground">
                                            <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin mb-4"></div>
                                            <p className="font-medium animate-pulse">Loading eligible recommendations...</p>                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : visibleFinal.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={4} className="text-center h-48">
                                        <div className="flex flex-col items-center justify-center text-muted-foreground gap-2">
                                            <FileText className="w-12 h-12 text-muted-foreground/30" />
                                            <p className="font-medium">{emptyMessage("recommendations", "No recommended applicants awaiting final.")}</p>
                                            {filtersActive && (
                                                <Button variant="outline" size="sm" onClick={clearFilters}>Clear filters</Button>
                                            )}
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                pagedFinal.map((row) => {
                                    const ungraded = ungradedFinalFor(row.id);
                                    return (
                                    <TableRow key={row.id} className="hover:bg-muted/40 transition-colors border-border/50 group">
                                        <TableCell className="pl-6 h-16">
                                            <div className="font-bold text-foreground group-hover:text-primary transition-colors max-w-[220px] truncate" title={row.position ?? (row.manpower_request_id != null ? `#${row.manpower_request_id}` : "—")}>
                                                {row.position ?? (row.manpower_request_id != null ? `#${row.manpower_request_id}` : "—")}
                                            </div>
                                        </TableCell>
                                        <TableCell className="font-medium text-muted-foreground/80">
                                            <div className="max-w-[300px] truncate" title={row.full_name ?? undefined}>
                                            {row.full_name}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <VerdictChip verdict={row.latestFinalVerdict} />
                                        </TableCell>
                                        <TableCell className="pr-6 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                {ungraded && (
                                                    <Button variant="ghost" size="sm" asChild>
                                                        <Link href={`/hrm/interviews/grade/${ungraded.id}`} aria-label={`Grade recommendation ${row.id}`}>
                                                            <Pencil className="mr-2 h-4 w-4 text-muted-foreground" />
                                                            Grade
                                                        </Link>
                                                    </Button>
                                                )}
                                                <Button variant="ghost" size="sm" onClick={() => handleHistoryFinal(row.id)} aria-label={`View history for recommendation ${row.id}`}>
                                                    <Eye className="mr-2 h-4 w-4 text-muted-foreground" />
                                                    History
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                    );
                                })
                            )}
                        </TableBody>
                    </Table>
                    </div>
                    {/* Mobile: stacked cards so verdict + Grade/History stay reachable at narrow widths */}
                    <div className="space-y-3 p-3 sm:hidden">
                        {isLoading ? (
                            <div className="flex flex-col items-center justify-center text-muted-foreground h-32">
                                <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin mb-4"></div>
                                <p className="font-medium animate-pulse">Loading eligible recommendations...</p>
                            </div>
                        ) : pagedFinal.length === 0 ? (
                            <div className="flex flex-col items-center justify-center text-muted-foreground text-center gap-2 py-8">
                                <FileText className="w-12 h-12 text-muted-foreground/30" />
                                <p className="font-medium">{emptyMessage("recommendations", "No recommended applicants awaiting final.")}</p>
                                {filtersActive && (
                                    <Button variant="outline" size="sm" onClick={clearFilters}>Clear filters</Button>
                                )}
                            </div>
                        ) : (
                            pagedFinal.map((row) => {
                                const ungraded = ungradedFinalFor(row.id);
                                return (
                                    <div key={row.id} className="rounded-xl border border-border/60 p-4 space-y-3">
                                        <div className="min-w-0">
                                            <p className="font-bold text-foreground truncate" title={row.position ?? (row.manpower_request_id != null ? `#${row.manpower_request_id}` : "—")}>
                                                {row.position ?? (row.manpower_request_id != null ? `#${row.manpower_request_id}` : "—")}
                                            </p>
                                            <p className="mt-1 text-sm text-muted-foreground truncate" title={row.full_name ?? undefined}>
                                                {row.full_name}
                                            </p>
                                        </div>
                                        <div className="flex items-center justify-between gap-2">
                                            <VerdictChip verdict={row.latestFinalVerdict} />
                                            <div className="flex items-center gap-1">
                                                {ungraded && (
                                                    <Button variant="ghost" size="sm" asChild>
                                                        <Link href={`/hrm/interviews/grade/${ungraded.id}`} aria-label={`Grade recommendation ${row.id}`}>
                                                            <Pencil className="mr-1.5 h-4 w-4 text-muted-foreground" />
                                                            Grade
                                                        </Link>
                                                    </Button>
                                                )}
                                                <Button variant="ghost" size="sm" onClick={() => handleHistoryFinal(row.id)} aria-label={`View history for recommendation ${row.id}`}>
                                                    <Eye className="mr-1.5 h-4 w-4 text-muted-foreground" />
                                                    History
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                    <Pager
                        page={safePageFinal}
                        totalPages={totalPagesFinal}
                        total={visibleFinal.length}
                        onChange={setPageFinal}
                    />
                </div>
            )}
        </div>
    );
}

/**
 * Manpower-family verdict pill: Pending amber, Passed emerald, Failed red,
 * never-graded (null) zinc.
 * @param verdict - Latest stage verdict, or null when never graded.
 * @returns Colored pill chip for the verdict.
 */
function Pager({ page, totalPages, total, onChange }: { page: number; totalPages: number; total: number; onChange: (page: number) => void }) {
    if (totalPages <= 1) return null;
    return (
        <div className="flex items-center justify-between px-2 border-t border-border/50 py-2">
            <div className="flex-1 text-sm text-muted-foreground">
                {total} total rows
            </div>
            <div className="flex items-center space-x-6 lg:space-x-8">
                <div className="flex w-[100px] items-center justify-center text-sm font-medium">
                    Page {page} of {totalPages}
                </div>
                <div className="flex items-center space-x-2">
                    <Button
                        variant="outline"
                        className="hidden h-8 w-8 p-0 lg:flex"
                        onClick={() => onChange(1)}
                        disabled={page <= 1}
                        aria-label="Go to first page"
                    >
                        <ChevronsLeft className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="outline"
                        className="h-8 w-8 p-0"
                        onClick={() => onChange(page - 1)}
                        disabled={page <= 1}
                        aria-label="Go to previous page"
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="outline"
                        className="h-8 w-8 p-0"
                        onClick={() => onChange(page + 1)}
                        disabled={page >= totalPages}
                        aria-label="Go to next page"
                    >
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="outline"
                        className="hidden h-8 w-8 p-0 lg:flex"
                        onClick={() => onChange(totalPages)}
                        disabled={page >= totalPages}
                        aria-label="Go to last page"
                    >
                        <ChevronsRight className="h-4 w-4" />
                    </Button>
                </div>
            </div>
        </div>
    );
}

function VerdictChip({ verdict }: { verdict: string | null }) {
    if (verdict === "Pending") {
        return (
            <span className="px-3 py-1.5 border text-xs rounded-full font-bold uppercase tracking-wider bg-amber-500/10 text-amber-600 border-amber-500/20 inline-block w-[110px] text-center">
                Pending
            </span>
        );
    }
    if (verdict === "Passed") {
        return (
            <span className="px-3 py-1.5 border text-xs rounded-full font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-600 border-emerald-500/20 inline-block w-[110px] text-center">
                Passed
            </span>
        );
    }
    if (verdict === "Failed") {
        return (
            <span className="px-3 py-1.5 border text-xs rounded-full font-bold uppercase tracking-wider bg-red-500/10 text-red-600 border-red-500/20 inline-block w-[110px] text-center">
                Failed
            </span>
        );
    }
    return (
        <span className="px-3 py-1.5 border text-xs rounded-full font-bold uppercase tracking-wider bg-zinc-500/10 text-zinc-600 border-zinc-500/20 inline-block w-[110px] text-center">
            Not graded
        </span>
    );
}
