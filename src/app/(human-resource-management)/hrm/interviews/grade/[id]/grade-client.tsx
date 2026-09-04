"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { ClipboardCheck, Loader2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const GradeFormSchema = z.object({
    template_id: z.number({ error: "Please select a scoring template" }),
    verdict: z.enum(["Pending", "Passed", "Failed"], { error: "Please select a verdict" }),
    interview_date: z.string({ error: "Please select an interview date" }).min(1, { error: "Please select an interview date" }),
    notes: z.string().nullable().optional(),
    scores: z.array(
        z.number({ error: "Enter a score from 0 to 100" })
            .min(0, { error: "Score must be between 0 and 100" })
            .max(100, { error: "Score must be between 0 and 100" })
            .optional(),
    ),
});

type GradeFormValues = z.infer<typeof GradeFormSchema>;

/**
 * Scoring template shape from the existing
 * `/api/hrm/interview-criteria/templates` endpoint (GET returns
 * `{ templates: [...] }` with criteria joined per template).
 * Declared locally so this page never imports the criteria module —
 * the endpoint contract is the only coupling.
 */
interface ScoreTemplateCriterion {
    id?: number;
    name: string;
    weight_percentage: number;
    is_quiz_criterion: boolean;
    sort: number;
}

/**
 * Scoring template row with its weighted criteria.
 */
interface ScoreTemplate {
    id: number;
    stage: "Initial" | "Final";
    name: string;
    status: string;
    is_default_for_stage: boolean | number;
    criteria: ScoreTemplateCriterion[];
}

/**
 * Scheduled interview row shape from GET `/api/hrm/interviews/[id]`
 * (`{ data }` envelope). Only the fields grading needs are declared.
 */
interface ScheduledInterview {
    id: number;
    stage: "Initial" | "Final";
    application_id: number;
    verdict: string;
    score_sheet_id: number | null;
}

/**
 * Today as a date-input value (YYYY-MM-DD), the default interview date.
 * @returns Today in local calendar date form.
 */
function todayInputValue(): string {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${now.getFullYear()}-${month}-${day}`;
}

/**
 * Verdict pill colors copied verbatim from VerdictChip
 * (InterviewEligibleList): Passed emerald / Failed red / Pending amber.
 */
function verdictPill(verdict: string): string {
    if (verdict === "Passed") return "bg-emerald-500/10 text-emerald-600 border-emerald-500/20";
    if (verdict === "Failed") return "bg-red-500/10 text-red-600 border-red-500/20";
    return "bg-amber-500/10 text-amber-600 border-amber-500/20";
}

/**
 * Grade page client for a scheduled interview: all template criteria on one
 * page (score inputs 0–100, quiz row prefilled from the latest quiz attempt
 * percentage with an editable override), live composite SUM(score*weight)/100
 * as a guideline display only, MANUAL-ONLY verdict Select (never derived —
 * HR may Pass a subpar grade at their discretion), and an interview date
 * input. Submit creates the sheet + items + composite server-side, then links
 * them onto the interview row via PATCH. A row that already carries a sheet
 * renders "Already graded" with no form (no double-submit); Final re-grades
 * stay on the detail dialog's verdict control.
 */
export function GradeInterviewClient({ interviewId }: { interviewId: number | null }) {
    const [interview, setInterview] = useState<ScheduledInterview | null>(null);
    const [templates, setTemplates] = useState<ScoreTemplate[]>([]);
    const [selectedTemplate, setSelectedTemplate] = useState<ScoreTemplate | null>(null);
    const [quizPercentage, setQuizPercentage] = useState<number | null>(null);
    const [quizAttemptId, setQuizAttemptId] = useState<number | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [gradedVerdict, setGradedVerdict] = useState<string | null>(null);
    const [gradedComposite, setGradedComposite] = useState<number | null>(null);

    const form = useForm<GradeFormValues>({
        resolver: zodResolver(GradeFormSchema),
        defaultValues: {
            template_id: undefined as unknown as number,
            verdict: "Pending",
            interview_date: todayInputValue(),
            notes: "",
            scores: [],
        },
    });

    const watchedScores = useWatch({ control: form.control, name: "scores" });

    /**
     * Initial scores for a template: the quiz-criterion row is auto-filled
     * from the latest quiz attempt percentage (editable override afterwards);
     * every other criterion starts empty so the grader types each score
     * deliberately. Empty boxes fail submit validation until filled.
     */
    const buildScores = (template: ScoreTemplate | null, quiz: number | null): (number | undefined)[] => {
        if (!template) return [];
        return [...template.criteria]
            .sort((a, b) => a.sort - b.sort)
            .map((c) => {
                if (c.is_quiz_criterion && quiz != null && Number.isFinite(quiz)) {
                    return Math.min(100, Math.max(0, Math.round(quiz * 100) / 100));
                }
                return undefined;
            });
    };

    useEffect(() => {
        if (interviewId == null) {
            setLoadError("Interview not found.");
            setIsLoading(false);
            return;
        }
        let cancelled = false;
        const load = async () => {
            setIsLoading(true);
            setLoadError(null);
            try {
                const interviewRes = await fetch(`/api/hrm/interviews/${interviewId}`, { cache: "no-store" });
                if (!interviewRes.ok) throw new Error("Could not load this interview.");
                const interviewJson = await interviewRes.json();
                const row = interviewJson.data as ScheduledInterview | null;
                if (!row) throw new Error("Interview not found.");
                if (cancelled) return;
                setInterview(row);
                if (row.score_sheet_id != null) return;

                const [envelopeRes, templatesRes] = await Promise.all([
                    fetch("/api/hrm/interviews", { cache: "no-store" }),
                    fetch("/api/hrm/interview-criteria/templates", { cache: "no-store" }),
                ]);
                if (!templatesRes.ok) throw new Error("Could not load scoring templates.");
                const templatesJson = await templatesRes.json();
                const list: ScoreTemplate[] = Array.isArray(templatesJson.templates)
                    ? templatesJson.templates
                    : Array.isArray(templatesJson.data)
                        ? templatesJson.data
                        : [];
                let quiz: number | null = null;
                let attemptId: number | null = null;
                if (envelopeRes.ok) {
                    const envelope = await envelopeRes.json();
                    const eligible = Array.isArray(envelope.eligibleInitial) ? envelope.eligibleInitial as { id: number; quiz_attempt_id: number | null; quiz_attempt_percentage: number | null }[] : [];
                    const match = eligible.find((r) => r.id === row.application_id);
                    quiz = match?.quiz_attempt_percentage ?? null;
                    attemptId = match?.quiz_attempt_id ?? null;
                }
                if (cancelled) return;
                setQuizPercentage(quiz);
                setQuizAttemptId(attemptId);
                setTemplates(list);
                const stagePool = list.filter((t) => t.stage === row.stage);
                const pool = stagePool.length > 0 ? stagePool : list;
                const picked = pool.find((t) => t.is_default_for_stage === true || t.is_default_for_stage === 1)
                    ?? pool[0]
                    ?? null;
                setSelectedTemplate(picked);
                if (picked) {
                    form.setValue("template_id", picked.id);
                    form.setValue("scores", buildScores(picked, quiz));
                }
            } catch (err) {
                if (!cancelled) setLoadError(err instanceof Error ? err.message : "Could not load this interview.");
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        };
        load();
        return () => {
            cancelled = true;
        };
        // Load once per interview id — the template default is picked from the
        // fetched payload, never re-derived on unrelated renders.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [interviewId]);

    /**
     * Switch the scoring template; criteria (and quiz prefill) reload.
     */
    const handleTemplateChange = (id: string) => {
        const picked = templates.find((t) => t.id === Number(id)) ?? null;
        setSelectedTemplate(picked);
        form.setValue("template_id", picked?.id as number);
        form.setValue("scores", buildScores(picked, quizPercentage));
    };

    const sortedCriteria = useMemo(
        () => (selectedTemplate ? [...selectedTemplate.criteria].sort((a, b) => a.sort - b.sort) : []),
        [selectedTemplate],
    );

    /**
     * Live weighted-average composite guideline: SUM(score * weight) / 100.
     * Display only — the verdict below is chosen by the grader and must never
     * be derived from this number.
     */
    const composite = useMemo(() => {
        const scores = watchedScores ?? [];
        const total = sortedCriteria.reduce(
            (sum, c, i) => sum + (Number(scores[i]) || 0) * (Number(c.weight_percentage) || 0),
            0,
        );
        return Math.round((total / 100) * 100) / 100;
    }, [sortedCriteria, watchedScores]);

    const onSubmit = async (values: GradeFormValues) => {
        if (!interview || !selectedTemplate) {
            toast.error("Please select a scoring template before submitting.");
            return;
        }
        if (sortedCriteria.some((_, i) => values.scores[i] == null)) {
            toast.error("Enter a score for every criterion before submitting.");
            return;
        }
        setIsSubmitting(true);
        try {
            const items = sortedCriteria.map((c, i) => ({
                criterion_id: c.id ?? null,
                criterion_name_snapshot: c.name,
                weight_percentage_snapshot: Number(c.weight_percentage) || 0,
                is_quiz_criterion: c.is_quiz_criterion,
                quiz_attempt_id: c.is_quiz_criterion ? quizAttemptId : null,
                score: Number(values.scores[i]) || 0,
                sort: c.sort,
            }));
            // The verdict is MANUAL-ONLY: it comes straight from the grader's
            // Select and is NEVER auto-derived from the composite — HR may
            // Pass a subpar grade at their discretion (user decision). The
            // server creates the sheet + items + composite, then links them
            // onto the scheduled row with interviewed_by from the session.
            const response = await fetch(`/api/hrm/interviews/${interview.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    stage: interview.stage,
                    application_id: interview.application_id,
                    template_id: selectedTemplate.id,
                    verdict: values.verdict,
                    interviewed_at: values.interview_date,
                    notes: values.notes || null,
                    items,
                }),
            });
            const result = await response.json();
            if (!response.ok) {
                throw new Error(result.message || result.error || "Could not submit interview grading.");
            }
            setGradedVerdict(values.verdict);
            setGradedComposite(composite);
            toast.success("Interview graded successfully!");
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Could not submit interview grading.");
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isLoading) {
        return (
            <div className="mx-auto max-w-3xl">
                <div className="bg-card border border-border/50 rounded-2xl overflow-hidden shadow-sm">
                    <div className="flex flex-col items-center justify-center text-muted-foreground h-48">
                        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin mb-4"></div>
                        <p className="font-medium animate-pulse">Loading interview...</p>
                    </div>
                </div>
            </div>
        );
    }

    if (loadError || !interview) {
        return (
            <div className="mx-auto max-w-3xl">
                <div className="bg-card border border-border/50 rounded-2xl overflow-hidden shadow-sm">
                    <div className="flex flex-col items-center justify-center text-muted-foreground text-center h-48 gap-4">
                        <p className="font-medium">{loadError ?? "Interview not found."}</p>
                        <Button asChild variant="outline" className="rounded-full px-6">
                            <Link href="/hrm/interviews">Go Back</Link>
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    if (gradedVerdict) {
        return (
            <div className="mx-auto max-w-3xl">
                <div className="bg-card border border-border/50 rounded-2xl overflow-hidden shadow-sm p-6 md:p-10">
                    <div className="flex flex-col items-center text-center gap-4">
                        <ClipboardCheck className="w-12 h-12 text-emerald-600" />
                        <h1 className="text-2xl font-extrabold text-foreground">Interview graded</h1>
                        <p className="text-muted-foreground">
                            Composite: <span className="font-bold text-foreground">{gradedComposite}</span>
                        </p>
                        <span className={`px-3 py-1.5 border text-xs rounded-full font-bold uppercase tracking-wider inline-block w-[110px] text-center ${verdictPill(gradedVerdict)}`}>
                            {gradedVerdict}
                        </span>
                        <Button asChild className="rounded-full px-8 mt-2">
                            <Link href="/hrm/interviews">Go Back</Link>
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    if (interview.score_sheet_id != null) {
        return (
            <div className="mx-auto max-w-3xl">
                <div className="bg-card border border-border/50 rounded-2xl overflow-hidden shadow-sm p-6 md:p-10">
                    <div className="flex flex-col items-center text-center gap-4">
                        <h1 className="text-2xl font-extrabold text-foreground">Already graded</h1>
                        <p className="text-muted-foreground">This interview already has a submitted grade.</p>
                        <span className={`px-3 py-1.5 border text-xs rounded-full font-bold uppercase tracking-wider inline-block w-[110px] text-center ${verdictPill(interview.verdict)}`}>
                            {interview.verdict}
                        </span>
                        <Button asChild variant="outline" className="rounded-full px-6 mt-2">
                            <Link href="/hrm/interviews">Go Back</Link>
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-3xl space-y-6">
            <div className="flex items-center gap-3">
                <div className="p-3 bg-primary/10 rounded-2xl shadow-sm border border-primary/20">
                    <ClipboardCheck className="w-8 h-8 text-primary" />
                </div>
                <div className="min-w-0">
                    <h1 className="text-4xl font-extrabold tracking-tight text-foreground truncate">
                        Grade {interview.stage} Interview
                    </h1>
                    <p className="text-muted-foreground/80 font-medium mt-1 text-lg">
                        Score each criterion from 0 to 100.
                    </p>
                </div>
            </div>

            <div className="bg-card border border-border/50 rounded-2xl overflow-hidden shadow-sm p-6">
                {templates.length === 0 ? (
                    <div className="flex flex-col items-center justify-center text-muted-foreground text-center h-48 gap-4">
                        <p className="font-medium">No scoring templates available for this stage.</p>
                        <Button asChild variant="outline" className="rounded-full px-6">
                            <Link href="/hrm/interviews">Go Back</Link>
                        </Button>
                    </div>
                ) : (
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                            <FormField
                                control={form.control}
                                name="template_id"
                                render={() => (
                                    <FormItem>
                                        <FormLabel className="text-xs font-bold uppercase text-muted-foreground mb-2">
                                            Scoring Template <span className="text-destructive">*</span>
                                        </FormLabel>
                                        <Select
                                            value={selectedTemplate ? String(selectedTemplate.id) : ""}
                                            onValueChange={handleTemplateChange}
                                        >
                                            <FormControl>
                                                <SelectTrigger className="truncate bg-muted/30 focus:bg-background transition-colors">
                                                    <SelectValue placeholder="Select template" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent className="max-h-80">
                                                {templates
                                                    .filter((t) => t.stage === interview.stage)
                                                    .map((t) => (
                                                        <SelectItem key={t.id} value={String(t.id)}>
                                                            {t.name}{t.is_default_for_stage === true || t.is_default_for_stage === 1 ? " (default)" : ""}
                                                        </SelectItem>
                                                    ))}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            {selectedTemplate && (
                                <div className="space-y-3">
                                    <h3 className="text-sm font-semibold">Criteria</h3>
                                    {sortedCriteria.map((criterion, index) => (
                                        <FormField
                                            key={criterion.id ?? `${criterion.name}-${index}`}
                                            control={form.control}
                                            name={`scores.${index}` as const}
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-1.5">
                                                        {!!criterion.is_quiz_criterion && (
                                                            <Lock className="h-3 w-3 shrink-0" />
                                                        )}
                                                        <span className="truncate" title={criterion.name}>
                                                            {criterion.name} ({criterion.weight_percentage}%)
                                                        </span>
                                                        <span className="text-destructive">*</span>
                                                        {!!criterion.is_quiz_criterion && (
                                                            <span className="font-normal normal-case text-muted-foreground">
                                                                — auto-filled from quiz, editable
                                                            </span>
                                                        )}
                                                    </FormLabel>
                                                    <FormControl>
                                                        <Input
                                                            type="number"
                                                            min={0}
                                                            max={100}
                                                            className="bg-muted/30 focus:bg-background transition-colors"
                                                            value={field.value ?? ""}
                                                            onChange={(e) => field.onChange(e.target.value === "" ? undefined : Number(e.target.value))}
                                                        />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    ))}
                                </div>
                            )}

                            <FormField
                                control={form.control}
                                name="verdict"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-xs font-bold uppercase text-muted-foreground mb-2">
                                            Verdict <span className="text-destructive">*</span>
                                        </FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl>
                                                <SelectTrigger className="truncate bg-muted/30 focus:bg-background transition-colors">
                                                    <SelectValue placeholder="Select verdict" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent className="max-h-80">
                                                <SelectItem value="Pending">Pending</SelectItem>
                                                <SelectItem value="Passed">Passed</SelectItem>
                                                <SelectItem value="Failed">Failed</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="interview_date"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-xs font-bold uppercase text-muted-foreground mb-2">
                                            Interview Date <span className="text-destructive">*</span>
                                        </FormLabel>
                                        <FormControl>
                                            <Input
                                                type="date"
                                                className="bg-muted/30 focus:bg-background transition-colors"
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="notes"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-xs font-bold uppercase text-muted-foreground">
                                            Notes
                                        </FormLabel>
                                        <FormControl>
                                            <Textarea
                                                placeholder="Grader notes (optional)"
                                                className="min-h-[100px] resize-none bg-muted/30 focus:bg-background transition-colors"
                                                rows={4}
                                                {...field}
                                                value={field.value || ""}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-2">
                                <Button asChild variant="outline" className="rounded-full px-6">
                                    <Link href="/hrm/interviews">Go Back</Link>
                                </Button>
                                <Button
                                    type="submit"
                                    disabled={isSubmitting || !selectedTemplate}
                                    className="rounded-full px-8 shadow-sm hover:shadow-md transition-all"
                                >
                                    {isSubmitting ? (
                                        <>
                                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                            Submitting...
                                        </>
                                    ) : (
                                        "Submit Grade"
                                    )}
                                </Button>
                            </div>
                        </form>
                    </Form>
                )}
            </div>
        </div>
    );
}
