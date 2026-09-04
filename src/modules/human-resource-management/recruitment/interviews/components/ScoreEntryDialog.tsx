"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { AlertTriangle, Check, ClipboardCheck, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useInterview } from "../hooks/useInterview";
import type { InterviewCreateInput } from "../types";
import type { InterviewScoreItemInput } from "../providers/InterviewProvider";

const ScoreEntryFormSchema = z.object({
    template_id: z.number({ error: "Please select a scoring template" }),
    verdict: z.enum(["Pending", "Passed", "Failed"], { error: "Please select a verdict" }),
    interview_date: z.string({ error: "Please select an interview date" }).min(1, { error: "Please select an interview date" }),
    notes: z.string().nullable().optional(),
    scores: z.array(
        z.number({ error: "Enter a score from 0 to 100" })
            .min(0, { error: "Score must be between 0 and 100" })
            .max(100, { error: "Score must be between 0 and 100" }),
    ),
});

type ScoreEntryFormValues = z.infer<typeof ScoreEntryFormSchema>;

/**
 * Scoring template shape from the existing
 * `/api/hrm/interview-criteria/templates` endpoint (GET returns
 * `{ templates: [...] }` with criteria joined per template).
 * Declared locally so this dialog never imports the criteria module —
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
 * Score entry dialog for grading an eligible applicant interview.
 *
 * Opens via `isGradeOpen` + `gradeContext` from the interview provider. On
 * open only (never on module mount) it fetches the existing criteria
 * templates endpoint, auto-picks the `is_default_for_stage` template for
 * `gradeContext.stage` (switchable via Select, which reloads criteria), and
 * prefills the quiz-criterion row from the graded application's quiz score in
 * `eligibleInitial` (editable override; Final templates carry no quiz row per
 * criteria rules, which is handled gracefully). The live composite
 * (SUM(score * weight) / 100) is a guideline display only — the verdict
 * Select stays MANUAL-ONLY and is never derived from the composite.
 * Submits through `provider.submitInterview` with an items array; the server
 * injects `interviewed_by` plus timestamps.
 */
export function ScoreEntryDialog() {
    const {
        isGradeOpen,
        setIsGradeOpen,
        gradeContext,
        eligibleInitial,
        eligibleFinal,
        submitInterview,
        hasGradedFinal,
    } = useInterview();

    const [templates, setTemplates] = useState<ScoreTemplate[]>([]);
    const [templatesLoading, setTemplatesLoading] = useState(false);
    const [selectedTemplate, setSelectedTemplate] = useState<ScoreTemplate | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const form = useForm<ScoreEntryFormValues>({
        resolver: zodResolver(ScoreEntryFormSchema),
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
     * Quiz percentage for the row being graded, looked up from the eligible
     * Initial list by applicationId (gradeContext carries no quiz fields by
     * design — extension is forbidden). Null when the application is not an
     * Initial eligible row or has no recorded quiz score.
     */
    const quizPercentage = useMemo(() => {
        if (gradeContext.applicationId == null) return null;
        const row = eligibleInitial.find((r) => r.id === gradeContext.applicationId);
        return row?.quiz_score ?? null;
    }, [eligibleInitial, gradeContext.applicationId]);

    /**
     * Initial scores for a template: the quiz-criterion row is auto-filled
     * from the eligible row's quiz percentage (editable override afterwards);
     * every other criterion starts at 0. Templates without a quiz row (all
     * Final templates, per criteria rules) simply yield zeroed rows.
     */
    const buildScores = (template: ScoreTemplate | null, quiz: number | null): number[] => {
        if (!template) return [];
        return [...template.criteria]
            .sort((a, b) => a.sort - b.sort)
            .map((c) => {
                if (c.is_quiz_criterion && quiz != null && Number.isFinite(quiz)) {
                    return Math.min(100, Math.max(0, Math.round(quiz * 100) / 100));
                }
                return 0;
            });
    };

    useEffect(() => {
        if (!isGradeOpen) return;
        let cancelled = false;
        const load = async () => {
            setTemplatesLoading(true);
            setSelectedTemplate(null);
            form.reset({
                template_id: undefined as unknown as number,
                verdict: "Pending",
                interview_date: todayInputValue(),
                notes: "",
                scores: [],
            });
            try {
                const res = await fetch("/api/hrm/interview-criteria/templates", { cache: "no-store" });
                if (!res.ok) throw new Error("Failed to load scoring templates");
                const data = await res.json();
                const list: ScoreTemplate[] = Array.isArray(data.templates)
                    ? data.templates
                    : Array.isArray(data.data)
                        ? data.data
                        : [];
                if (cancelled) return;
                setTemplates(list);
                const stagePool = list.filter((t) => t.stage === gradeContext.stage);
                const pool = stagePool.length > 0 ? stagePool : list;
                const picked = pool.find((t) => t.is_default_for_stage === true || t.is_default_for_stage === 1)
                    ?? pool[0]
                    ?? null;
                setSelectedTemplate(picked);
                if (picked) {
                    const quizRow = cancelled
                        ? null
                        : eligibleInitial.find((r) => r.id === gradeContext.applicationId)?.quiz_score ?? null;
                    form.setValue("template_id", picked.id);
                    form.setValue("scores", buildScores(picked, quizRow));
                }
            } catch (err) {
                if (!cancelled) {
                    toast.error(err instanceof Error ? err.message : "Could not load scoring templates");
                }
            } finally {
                if (!cancelled) setTemplatesLoading(false);
            }
        };
        load();
        return () => {
            cancelled = true;
        };
        // Fetch on dialog open only — gradeContext is set by the caller before
        // opening, so the open flag alone drives the load (never module mount).
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isGradeOpen]);

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

    const totalWeight = useMemo(
        () => sortedCriteria.reduce((sum, c) => sum + (Number(c.weight_percentage) || 0), 0),
        [sortedCriteria],
    );
    const weightIsValid = Math.abs(totalWeight - 100) < 0.01;

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

    const onSubmit = async (values: ScoreEntryFormValues) => {
        if (!selectedTemplate) {
            toast.error("Please select a scoring template before submitting.");
            return;
        }
        if (gradeContext.applicationId == null) {
            toast.error("No application selected for grading.");
            return;
        }
        if (
            gradeContext.stage === "Final" &&
            gradeContext.recommendationId != null &&
            hasGradedFinal(gradeContext.recommendationId)
        ) {
            const ok = confirm(
                `Recommendation #${gradeContext.recommendationId} already has a graded final interview. Grade again anyway? This keeps history (latest-wins) — it does not overwrite the earlier grade.`,
            );
            if (!ok) return;
        }
        setIsSubmitting(true);
        try {
            const items: InterviewScoreItemInput[] = sortedCriteria.map((c, i) => ({
                criterion_id: c.id ?? null,
                criterion_name_snapshot: c.name,
                weight_percentage_snapshot: Number(c.weight_percentage) || 0,
                is_quiz_criterion: c.is_quiz_criterion,
                score: Number(values.scores[i]) || 0,
                sort: c.sort,
            }));
            // Wire payload is the client-owned CreateInput keys + items array —
            // interviewed_by/interviewed_at/created_at are injected server-side
            // (the date input below is kept for grader context; the server
            // stamps interviewed_at via nowPH()).
            // Verdict is MANUAL-ONLY: it comes straight from the grader's
            // Select and is NEVER auto-derived from the composite — HR may
            // Pass a subpar grade at their discretion (user decision).
            const finalRow = gradeContext.recommendationId != null
                ? eligibleFinal.find((r) => r.id === gradeContext.recommendationId)
                : undefined;
            const payload: InterviewCreateInput & { items: InterviewScoreItemInput[] } = {
                stage: gradeContext.stage,
                application_id: gradeContext.applicationId,
                manpower_request_id: gradeContext.stage === "Final" ? (finalRow?.manpower_request_id ?? null) : null,
                recommendation_id: gradeContext.recommendationId ?? null,
                template_id: selectedTemplate.id,
                verdict: values.verdict,
                interviewed_at: values.interview_date,
                notes: values.notes || null,
                items,
            };
            const success = await submitInterview(payload);
            if (success) {
                setIsGradeOpen(false);
                form.reset();
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to submit interview grading.";
            toast.error(message);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={isGradeOpen} onOpenChange={setIsGradeOpen}>
            <DialogContent className="w-[95vw] sm:max-w-[500px] p-0 overflow-hidden border border-border/40 shadow-2xl bg-background rounded-2xl flex flex-col max-h-[90vh]">
                <div className="p-6 border-b border-border/40 bg-card">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-extrabold flex items-center gap-3">
                            <ClipboardCheck className="w-6 h-6 text-primary" />
                            Grade {gradeContext.stage} Interview
                        </DialogTitle>
                        <DialogDescription className="text-sm mt-2">
                            Score each criterion from 0 to 100. The composite is a guideline only — the verdict is your call.
                        </DialogDescription>
                    </DialogHeader>
                </div>

                <div className="p-6 flex-1 overflow-y-auto min-h-0">
                    {templatesLoading ? (
                        <p className="text-sm text-muted-foreground">Loading scoring templates…</p>
                    ) : templates.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No scoring templates available for this stage.</p>
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
                                                        .filter((t) => t.stage === gradeContext.stage)
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
                                        <div className="flex items-center justify-between">
                                            <h3 className="text-sm font-semibold">Criteria</h3>
                                            <Badge variant={weightIsValid ? "default" : "destructive"} className="gap-1">
                                                {weightIsValid ? (
                                                    <Check className="h-3 w-3" />
                                                ) : (
                                                    <AlertTriangle className="h-3 w-3" />
                                                )}
                                                Weights total: {totalWeight}%
                                            </Badge>
                                        </div>
                                        {sortedCriteria.map((criterion, index) => (
                                            <FormField
                                                key={criterion.id ?? `${criterion.name}-${index}`}
                                                control={form.control}
                                                name={`scores.${index}` as const}
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-1.5">
                                                            {criterion.is_quiz_criterion && (
                                                                <Lock className="h-3 w-3 shrink-0" />
                                                            )}
                                                            <span className="truncate" title={criterion.name}>
                                                                {criterion.name} ({criterion.weight_percentage}%)
                                                            </span>
                                                            <span className="text-destructive">*</span>
                                                            {criterion.is_quiz_criterion && (
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
                                                                value={field.value ?? 0}
                                                                onChange={(e) => field.onChange(e.target.value === "" ? 0 : Number(e.target.value))}
                                                            />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                        ))}
                                        <div className="rounded-lg border p-3 space-y-1">
                                            <p className="text-sm font-semibold">Composite: {composite}</p>
                                            <p className="text-xs text-muted-foreground">
                                                Guideline only — the verdict below is manual and never follows this score automatically.
                                            </p>
                                        </div>
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
                            </form>
                        </Form>
                    )}
                </div>

                <div className="p-4 md:p-6 bg-muted/20 border-t border-border/40">
                    <DialogFooter className="flex w-full sm:justify-end gap-3">
                        <DialogClose asChild>
                            <Button type="button" variant="outline" onClick={() => setIsGradeOpen(false)} className="rounded-full px-6">
                                Cancel
                            </Button>
                        </DialogClose>
                        <Button
                            type="submit"
                            disabled={isSubmitting || templatesLoading || !selectedTemplate}
                            onClick={form.handleSubmit(onSubmit)}
                            className="rounded-full px-8 shadow-sm hover:shadow-md transition-all"
                        >
                            {isSubmitting ? (
                                <>
                                    <div className="w-4 h-4 mr-2 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin"></div>
                                    Submitting...
                                </>
                            ) : (
                                "Submit Grade"
                            )}
                        </Button>
                    </DialogFooter>
                </div>
            </DialogContent>
        </Dialog>
    );
}
