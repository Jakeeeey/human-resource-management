"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import type { Quiz, QuizFormData, QuizStatus, PassThresholdType } from "../types";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { X } from "lucide-react";

interface FormData {
    name: string;
    description: string;
    status: QuizStatus;
    pass_threshold_value: string;
    time_limit_enabled: boolean;
    time_limit_minutes: string;
    number_of_questions: string;
    shuffle_questions: boolean;
    shuffle_answers: boolean;
    category_filter: string[];
    is_applicant_quiz: boolean;
}

const PASS_THRESHOLD_TYPE: PassThresholdType = "percentage";

const DEFAULT_FORM: FormData = {
    name: "",
    description: "",
    status: "draft",
    pass_threshold_value: "80",
    time_limit_enabled: false,
    time_limit_minutes: "",
    number_of_questions: "10",
    shuffle_questions: true,
    shuffle_answers: true,
    category_filter: [],
    is_applicant_quiz: false,
};

interface QuizSettingsDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    quiz?: Quiz | null;
    onSubmit: (data: QuizFormData) => Promise<void>;
}

export function QuizSettingsDialog({
    open,
    onOpenChange,
    quiz,
    onSubmit,
}: QuizSettingsDialogProps) {
    const isEdit = !!quiz;

    const form = useForm<FormData>({ defaultValues: DEFAULT_FORM });
    const [categoryOptions, setCategoryOptions] = useState<string[]>([]);
    // Category of every active pool question -- used to size the pool for the
    // "applicant quiz" guard.
    const [activeQuestionCategories, setActiveQuestionCategories] = useState<(string | null)[]>([]);

    useEffect(() => {
        if (!open) return;
        fetch("/api/hrm/quiz-file-management/file-management?includeInactive=true")
            .then((res) => res.json())
            .then((data) => {
                const rows: { category: string | null; is_active?: boolean }[] = data.questions || [];
                const set = new Set<string>();
                rows.forEach((q) => {
                    if (q.category) set.add(q.category);
                });
                setCategoryOptions(Array.from(set).sort());
                setActiveQuestionCategories(
                    rows.filter((q) => q.is_active !== false).map((q) => q.category ?? null)
                );
            })
            .catch(() => {
                setCategoryOptions([]);
                setActiveQuestionCategories([]);
            });
    }, [open]);

    useEffect(() => {
        if (open && quiz) {
            form.reset({
                name: quiz.name,
                description: quiz.description || "",
                status: quiz.status,
                pass_threshold_value: quiz.pass_threshold_value.toString(),

                time_limit_enabled: Boolean(quiz.time_limit_enabled),
                time_limit_minutes: quiz.time_limit_minutes?.toString() || "",
                number_of_questions: quiz.number_of_questions.toString(),
                shuffle_questions: Boolean(quiz.shuffle_questions),
                shuffle_answers: Boolean(quiz.shuffle_answers),
                category_filter: quiz.category_filter || [],
                is_applicant_quiz: Boolean(quiz.is_applicant_quiz),
            });
        } else if (!open) {
            form.reset(DEFAULT_FORM);
        }
    }, [open, quiz, form]);

    const timeLimitEnabled = useWatch({ control: form.control, name: "time_limit_enabled" });
    const watchedStatus = useWatch({ control: form.control, name: "status" });
    const watchedCategoryFilter = useWatch({ control: form.control, name: "category_filter" });
    const watchedNumberOfQuestions = useWatch({ control: form.control, name: "number_of_questions" });

    // Live count of active questions this quiz would draw from, given its current
    // category filter -- mirrors the pool logic the draw endpoint uses.
    const poolSize = useMemo(() => {
        const cats = watchedCategoryFilter || [];
        return cats.length
            ? activeQuestionCategories.filter((c) => c != null && cats.includes(c)).length
            : activeQuestionCategories.length;
    }, [activeQuestionCategories, watchedCategoryFilter]);

    const requiredCount = parseInt(watchedNumberOfQuestions || "0", 10) || 0;
    const applicantQuizEligible = watchedStatus === "active" && poolSize >= requiredCount;

    const handleSubmit = async (data: FormData) => {
        if (data.is_applicant_quiz) {
            if (data.status !== "active") {
                form.setError("is_applicant_quiz", {
                    message:
                        "Only an Active quiz can be the applicant quiz. Set the status to Active first.",
                });
                return;
            }
            const need = parseInt(data.number_of_questions, 10) || 0;
            const cats = data.category_filter || [];
            const pool = cats.length
                ? activeQuestionCategories.filter((c) => c != null && cats.includes(c)).length
                : activeQuestionCategories.length;
            if (pool < need) {
                form.setError("is_applicant_quiz", {
                    message: `This quiz draws ${need} questions but only ${pool} active question(s) match its pool. Add questions or lower the draw count first.`,
                });
                return;
            }
        }

        try {
            await onSubmit({
                name: data.name,
                description: data.description,
                status: data.status,
                pass_threshold_type: PASS_THRESHOLD_TYPE,
                pass_threshold_value: parseInt(data.pass_threshold_value, 10) || 0,
                time_limit_enabled: data.time_limit_enabled,
                time_limit_minutes: data.time_limit_enabled
                    ? parseInt(data.time_limit_minutes, 10) || null
                    : null,
                number_of_questions: parseInt(data.number_of_questions, 10) || 0,
                shuffle_questions: data.shuffle_questions,
                shuffle_answers: data.shuffle_answers,
                category_filter: data.category_filter,
                is_applicant_quiz: data.is_applicant_quiz,
            });
            onOpenChange(false);
            form.reset();
        } catch (error) {
            console.error("Error submitting quiz:", error);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[560px] max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{isEdit ? "Edit Quiz Settings" : "Create Quiz"}</DialogTitle>
                    <DialogDescription>
                        {isEdit
                            ? "Update this quiz's configuration."
                            : "Configure a new quiz. Questions are drawn from the shared File Management pool once quiz-taking is built."}
                    </DialogDescription>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="name"
                            rules={{ required: "Name is required" }}
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Quiz Name</FormLabel>
                                    <FormControl>
                                        <Input placeholder="e.g. New Employee Onboarding" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="description"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Description</FormLabel>
                                    <FormControl>
                                        <Textarea placeholder="Enter description" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="status"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Status</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="draft">Draft</SelectItem>
                                            <SelectItem value="active">Active</SelectItem>
                                            <SelectItem value="archived">Archived</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <Separator />

                        <FormField
                            control={form.control}
                            name="number_of_questions"
                            rules={{
                                required: "Number of questions is required",
                                validate: (v) =>
                                    parseInt(v, 10) >= 1 || "Must be at least 1",
                            }}
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Number of Questions to Draw</FormLabel>
                                    <FormControl>
                                        <Input type="number" min={1} {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="category_filter"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Restrict to Categories</FormLabel>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <FormControl>
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    className="w-full justify-start font-normal"
                                                >
                                                    {field.value.length
                                                        ? `${field.value.length} categor${
                                                              field.value.length > 1 ? "ies" : "y"
                                                          } selected`
                                                        : "All categories"}
                                                </Button>
                                            </FormControl>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-[--radix-popover-trigger-width] p-2" align="start">
                                            {categoryOptions.length === 0 && (
                                                <p className="px-2 py-1.5 text-sm text-muted-foreground">
                                                    No categories found.
                                                </p>
                                            )}
                                            {categoryOptions.map((category) => (
                                                <div
                                                    key={category}
                                                    className="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-muted"
                                                >
                                                    <Checkbox
                                                        id={`category-filter-${category}`}
                                                        checked={field.value.includes(category)}
                                                        onCheckedChange={(checked) => {
                                                            field.onChange(
                                                                checked
                                                                    ? [...field.value, category]
                                                                    : field.value.filter(
                                                                          (c: string) => c !== category
                                                                      )
                                                            );
                                                        }}
                                                    />
                                                    <label
                                                        htmlFor={`category-filter-${category}`}
                                                        className="flex-1 cursor-pointer text-sm"
                                                    >
                                                        {category}
                                                    </label>
                                                </div>
                                            ))}
                                        </PopoverContent>
                                    </Popover>
                                    {field.value.length > 0 && (
                                        <div className="flex flex-wrap gap-1">
                                            {field.value.map((category: string) => (
                                                <Badge key={category} variant="secondary" className="gap-1">
                                                    {category}
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            field.onChange(
                                                                field.value.filter((c: string) => c !== category)
                                                            )
                                                        }
                                                    >
                                                        <X className="h-3 w-3" />
                                                    </button>
                                                </Badge>
                                            ))}
                                        </div>
                                    )}
                                    <FormDescription>
                                        Leave empty to draw from every active category. Categories come
                                        from File Management&apos;s own Category tag.
                                    </FormDescription>
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="is_applicant_quiz"
                            render={({ field }) => (
                                <FormItem className="rounded-lg border p-3 space-y-2">
                                    <div className="flex items-center justify-between">
                                        <FormLabel className="!mt-0">Applicant quiz</FormLabel>
                                        <FormControl>
                                            <Switch
                                                checked={field.value}
                                                onCheckedChange={(v) => {
                                                    form.clearErrors("is_applicant_quiz");
                                                    field.onChange(v);
                                                }}
                                                disabled={!field.value && !applicantQuizEligible}
                                            />
                                        </FormControl>
                                    </div>
                                    <FormDescription>
                                        The applicant flow (application form &rarr; quiz) uses whichever
                                        quiz is marked here. Only one quiz can hold this at a time, and
                                        only an Active quiz whose pool covers its draw count.
                                        {" "}
                                        {watchedStatus !== "active"
                                            ? "Set the status to Active to enable this."
                                            : `${poolSize} active question(s) currently match this quiz's pool (needs ${requiredCount}).`}
                                    </FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="shuffle_questions"
                            render={({ field }) => (
                                <FormItem className="flex items-center justify-between rounded-lg border p-3">
                                    <FormLabel className="!mt-0">Shuffle Question Order</FormLabel>
                                    <FormControl>
                                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                                    </FormControl>
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="shuffle_answers"
                            render={({ field }) => (
                                <FormItem className="flex items-center justify-between rounded-lg border p-3">
                                    <FormLabel className="!mt-0">Shuffle Answer Order</FormLabel>
                                    <FormControl>
                                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                                    </FormControl>
                                </FormItem>
                            )}
                        />

                        <Separator />

                        <FormField
                            control={form.control}
                            name="pass_threshold_value"
                            rules={{
                                required: "Pass threshold is required",
                                validate: (value) => {
                                    const n = parseInt(value, 10);
                                    if (n > 100) {
                                        return "Cannot exceed 100%";
                                    }
                                    return true;
                                },
                            }}
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Pass Threshold</FormLabel>
                                    <FormControl>
                                        <div className="relative">
                                            <Input
                                                type="number"
                                                min={0}
                                                max={100}
                                                className="pr-7"
                                                {...field}
                                            />
                                            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                                                %
                                            </span>
                                        </div>
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="time_limit_enabled"
                            render={({ field }) => (
                                <FormItem className="flex items-center justify-between rounded-lg border p-3">
                                    <FormLabel className="!mt-0">Enable Time Limit</FormLabel>
                                    <FormControl>
                                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                                    </FormControl>
                                </FormItem>
                            )}
                        />

                        {timeLimitEnabled && (
                            <FormField
                                control={form.control}
                                name="time_limit_minutes"
                                rules={{ required: "Time limit is required when enabled" }}
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Time Limit (minutes)</FormLabel>
                                        <FormControl>
                                            <Input type="number" min={1} {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        )}

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                                Cancel
                            </Button>
                            <Button type="submit">{isEdit ? "Update" : "Create"} Quiz</Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
