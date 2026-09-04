"use client";

import { useState } from "react";
import { useInterview } from "../hooks/useInterview";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import { Eye, FileText, Pencil } from "lucide-react";

/**
 * Tabbed eligible list for applicant interview grading.
 *
 * Initial tab rows quiz-completed applications (applicant, quiz score +
 * passed/failed badge, latest initial verdict chip); Final tab rows approved
 * recommendations (request ref, applicant, rec status, latest final verdict
 * chip). Grade wires gradeContext per stage and opens the score entry dialog
 * (T7); History selects the latest interview via handleView — the detail
 * dialog itself lands in T8, so History is selection-only for now.
 *
 * Search filters through the hook joined-text lists (filteredInitial /
 * filteredFinal); the Awaiting-verdict chip toggles a Pending-verdict-only
 * filter on the active tab. Applicant/request display joins defensively: the
 * T4 envelope carries FK ids only (no names), so userDisplay() resolves when
 * the id exists in users and falls back to `#id` labels otherwise.
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
        setGradeContext,
        setIsGradeOpen,
        handleView,
        latestPerApplication,
        userDisplay,
    } = useInterview();
    const [pendingOnly, setPendingOnly] = useState(false);

    if (error) {
        return <div className="p-4 text-red-500 bg-red-50 rounded-lg">Error: {error}</div>;
    }

    const initialPendingCount = filteredInitial.filter((row) => row.latestInitialVerdict === "Pending").length;
    const finalPendingCount = filteredFinal.filter((row) => row.latestFinalVerdict === "Pending").length;

    const visibleInitial = pendingOnly
        ? filteredInitial.filter((row) => row.latestInitialVerdict === "Pending")
        : filteredInitial;
    const visibleFinal = pendingOnly
        ? filteredFinal.filter((row) => row.latestFinalVerdict === "Pending")
        : filteredFinal;

    const pendingCount = stageTab === "Initial" ? initialPendingCount : finalPendingCount;

    const handleGradeInitial = (applicationId: number) => {
        setGradeContext({ stage: "Initial", applicationId });
        setIsGradeOpen(true);
    };

    const handleGradeFinal = (recommendationId: number, applicationId?: number) => {
        setGradeContext({ stage: "Final", recommendationId, applicationId });
        setIsGradeOpen(true);
    };

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
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-foreground">Interviews</h2>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => setPendingOnly((prev) => !prev)}
                        aria-pressed={pendingOnly}
                        title="Show only rows awaiting an explicit verdict"
                        className={`px-3 py-1.5 border text-xs rounded-full font-bold uppercase tracking-wider inline-block text-center transition-colors ${pendingOnly ? "bg-amber-500/20 text-amber-700 border-amber-500/40" : "bg-amber-500/10 text-amber-600 border-amber-500/20"}`}
                    >
                        Awaiting verdict: {pendingCount}
                    </button>
                    <Input
                        placeholder="Search applicant, score, verdict..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-64"
                    />
                </div>
            </div>
            <Tabs
                value={stageTab}
                onValueChange={(value) => {
                    setStageTab(value as "Initial" | "Final");
                    setPendingOnly(false);
                }}
            >
                <TabsList aria-label="Interview stage">
                    <TabsTrigger value="Initial">
                        Initial
                        <span className="ml-2 rounded-full bg-blue-500/10 text-blue-600 border border-blue-500/20 px-2.5 py-0.5 text-xs font-bold">
                            {filteredInitial.length}
                        </span>
                    </TabsTrigger>
                    <TabsTrigger value="Final">
                        Final
                        <span className="ml-2 rounded-full bg-blue-500/10 text-blue-600 border border-blue-500/20 px-2.5 py-0.5 text-xs font-bold">
                            {filteredFinal.length}
                        </span>
                    </TabsTrigger>
                </TabsList>
            </Tabs>
            {stageTab === "Initial" ? (
                <div className="bg-card border border-border/50 rounded-2xl overflow-hidden shadow-sm">
                    <Table>
                        <TableHeader className="bg-muted/30">
                            <TableRow className="hover:bg-transparent border-border/50">
                                <TableHead className="font-bold text-xs uppercase tracking-wider text-muted-foreground pl-6 h-14">Applicant</TableHead>
                                <TableHead className="font-bold text-xs uppercase tracking-wider text-muted-foreground h-14 text-center">Quiz Score</TableHead>
                                <TableHead className="font-bold text-xs uppercase tracking-wider text-muted-foreground h-14 text-center">Quiz Result</TableHead>
                                <TableHead className="font-bold text-xs uppercase tracking-wider text-muted-foreground h-14 text-center">Initial Verdict</TableHead>
                                <TableHead className="font-bold text-xs uppercase tracking-wider text-muted-foreground h-14 text-right pr-6">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center h-48">
                                        <div className="flex flex-col items-center justify-center text-muted-foreground">
                                            <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin mb-4"></div>
                                            <p className="font-medium animate-pulse">Loading eligible applications...</p>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : visibleInitial.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center h-48">
                                        <div className="flex flex-col items-center justify-center text-muted-foreground">
                                            <FileText className="w-12 h-12 text-muted-foreground/30 mb-3" />
                                            <p className="font-medium">No quiz-completed applications.</p>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                visibleInitial.map((row) => (
                                    <TableRow key={row.id} className="hover:bg-muted/40 transition-colors border-border/50 group">
                                        <TableCell className="pl-6 h-16">
                                            <div className="font-bold text-foreground group-hover:text-primary transition-colors">
                                                {userDisplay(row.applicant_id)}
                                            </div>
                                            <div className="text-xs text-muted-foreground/70">
                                                Application #{row.id}
                                            </div>
                                        </TableCell>
                                        <TableCell className="font-medium text-muted-foreground/80 text-center">
                                            {row.quiz_score ?? "—"}
                                        </TableCell>
                                        <TableCell className="text-center">
                                            {row.quiz_passed === true ? (
                                                <span className="px-3 py-1.5 border text-xs rounded-full font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-600 border-emerald-500/20 inline-block w-[110px] text-center">
                                                    Passed
                                                </span>
                                            ) : row.quiz_passed === false ? (
                                                <span className="px-3 py-1.5 border text-xs rounded-full font-bold uppercase tracking-wider bg-red-500/10 text-red-600 border-red-500/20 inline-block w-[110px] text-center">
                                                    Failed
                                                </span>
                                            ) : (
                                                <span className="px-3 py-1.5 border text-xs rounded-full font-bold uppercase tracking-wider bg-zinc-500/10 text-zinc-600 border-zinc-500/20 inline-block w-[110px] text-center">
                                                    No quiz
                                                </span>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <VerdictChip verdict={row.latestInitialVerdict} />
                                        </TableCell>
                                        <TableCell className="pr-6 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <Button variant="ghost" size="sm" onClick={() => handleGradeInitial(row.id)} aria-label={`Grade application ${row.id}`}>
                                                    <Pencil className="mr-2 h-4 w-4 text-muted-foreground" />
                                                    Grade
                                                </Button>
                                                <Button variant="ghost" size="sm" onClick={() => handleHistoryInitial(row.id)} aria-label={`View history for application ${row.id}`}>
                                                    <Eye className="mr-2 h-4 w-4 text-muted-foreground" />
                                                    History
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            ) : (
                <div className="bg-card border border-border/50 rounded-2xl overflow-hidden shadow-sm">
                    <Table>
                        <TableHeader className="bg-muted/30">
                            <TableRow className="hover:bg-transparent border-border/50">
                                <TableHead className="font-bold text-xs uppercase tracking-wider text-muted-foreground pl-6 h-14">Request</TableHead>
                                <TableHead className="font-bold text-xs uppercase tracking-wider text-muted-foreground h-14">Applicant</TableHead>
                                <TableHead className="font-bold text-xs uppercase tracking-wider text-muted-foreground h-14 text-center">Rec Status</TableHead>
                                <TableHead className="font-bold text-xs uppercase tracking-wider text-muted-foreground h-14 text-center">Final Verdict</TableHead>
                                <TableHead className="font-bold text-xs uppercase tracking-wider text-muted-foreground h-14 text-right pr-6">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center h-48">
                                        <div className="flex flex-col items-center justify-center text-muted-foreground">
                                            <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin mb-4"></div>
                                            <p className="font-medium animate-pulse">Loading eligible recommendations...</p>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : visibleFinal.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center h-48">
                                        <div className="flex flex-col items-center justify-center text-muted-foreground">
                                            <FileText className="w-12 h-12 text-muted-foreground/30 mb-3" />
                                            <p className="font-medium">No approved recommendations awaiting final.</p>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                visibleFinal.map((row) => (
                                    <TableRow key={row.id} className="hover:bg-muted/40 transition-colors border-border/50 group">
                                        <TableCell className="pl-6 h-16">
                                            <div className="font-bold text-foreground group-hover:text-primary transition-colors">
                                                {row.manpower_request_id != null ? `Request #${row.manpower_request_id}` : "—"}
                                            </div>
                                            <div className="text-xs text-muted-foreground/70">
                                                Rec #{row.id}
                                            </div>
                                        </TableCell>
                                        <TableCell className="font-medium text-muted-foreground/80">
                                            {row.applicant_id != null ? userDisplay(row.applicant_id) : `Rec #${row.id}`}
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <span className="px-3 py-1.5 border text-xs rounded-full font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-600 border-emerald-500/20 inline-block w-[110px] text-center">
                                                {row.status}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <VerdictChip verdict={row.latestFinalVerdict} />
                                        </TableCell>
                                        <TableCell className="pr-6 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleGradeFinal(row.id, row.applicant_id ?? undefined)}
                                                    aria-label={`Grade recommendation ${row.id}`}
                                                >
                                                    <Pencil className="mr-2 h-4 w-4 text-muted-foreground" />
                                                    Grade
                                                </Button>
                                                <Button variant="ghost" size="sm" onClick={() => handleHistoryFinal(row.id)} aria-label={`View history for recommendation ${row.id}`}>
                                                    <Eye className="mr-2 h-4 w-4 text-muted-foreground" />
                                                    History
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
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
