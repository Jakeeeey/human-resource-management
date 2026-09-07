"use client";

import React, { useEffect } from "react";
import { useForm, useFieldArray, useWatch } from "react-hook-form";
import type { Template, TemplateFormData, Stage, TemplateStatus } from "../types";
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
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Lock, Plus, X, Check, AlertTriangle } from "lucide-react";

interface FormData {
    stage: Stage;
    name: string;
    status: TemplateStatus;
    is_default_for_stage: boolean;
    criteria: {
        name: string;
        weight_percentage: string;
        is_quiz_criterion: boolean;
    }[];
}

const DEFAULT_FORM: FormData = {
    stage: "Initial",
    name: "",
    status: "draft",
    is_default_for_stage: false,
    criteria: [],
};

const QUIZ_CRITERION_ROW = { name: "Quiz Score", weight_percentage: "0", is_quiz_criterion: true };

interface TemplateEditorDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    template?: Template | null;
    onSubmit: (data: TemplateFormData) => Promise<void>;
}

export function TemplateEditorDialog({
    open,
    onOpenChange,
    template,
    onSubmit,
}: TemplateEditorDialogProps) {
    const isEdit = !!template;

    const form = useForm<FormData>({ defaultValues: DEFAULT_FORM });
    const [weightError, setWeightError] = React.useState<string | null>(null);
    const { fields, append, prepend, remove } = useFieldArray({
        control: form.control,
        name: "criteria",
    });

    useEffect(() => {
        if (open && template) {
            form.reset({
                stage: template.stage,
                name: template.name,
                status: template.status,
                is_default_for_stage: template.is_default_for_stage,
                criteria: [...template.criteria]
                    .sort((a, b) => a.sort - b.sort)
                    .map((c) => ({
                        name: c.name,
                        weight_percentage: c.weight_percentage.toString(),
                        is_quiz_criterion: c.is_quiz_criterion,
                    })),
            });
        } else if (!open) {
            form.reset(DEFAULT_FORM);
        }
    }, [open, template, form]);

    const watchedStage = useWatch({ control: form.control, name: "stage" });

    useEffect(() => {
        if (isEdit) return;
        const quizRowIndex = fields.findIndex((f) => f.is_quiz_criterion);
        if (watchedStage === "Initial" && quizRowIndex === -1) {
            prepend(QUIZ_CRITERION_ROW);
        } else if (watchedStage === "Final" && quizRowIndex !== -1) {
            remove(quizRowIndex);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [watchedStage, isEdit]);

    const watchedCriteria = useWatch({ control: form.control, name: "criteria" }) || [];
    const totalWeight = watchedCriteria.reduce(
        (sum, c) => sum + (parseFloat(c.weight_percentage) || 0),
        0
    );
    const weightIsValid = Math.abs(totalWeight - 100) < 0.01;

    const handleSubmit = async (data: FormData) => {
        if (!weightIsValid) {
            setWeightError(
                `Criteria weights must add up to exactly 100% (currently ${totalWeight}%).`
            );
            return;
        }
        setWeightError(null);

        try {
            await onSubmit({
                stage: data.stage,
                name: data.name,
                status: data.status,
                is_default_for_stage: data.is_default_for_stage,
                criteria: data.criteria.map((c, index) => ({
                    name: c.name,
                    weight_percentage: parseFloat(c.weight_percentage) || 0,
                    is_quiz_criterion: c.is_quiz_criterion,
                    sort: index,
                })),
            });
            onOpenChange(false);
            form.reset();
        } catch (error) {
            console.error("Error submitting template:", error);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="w-[95vw] sm:max-w-[600px] max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{isEdit ? `Edit Template: ${template.name}` : "New Template"}</DialogTitle>
                    <DialogDescription>
                        Configure the weighted rubric used to score {watchedStage} interviews.
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
                                    <FormLabel>Template Name</FormLabel>
                                    <FormControl>
                                        <Input placeholder="e.g. Standard Initial Rubric" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="stage"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>
                                        Stage
                                        {isEdit && (
                                            <span className="ml-2 text-xs font-normal text-muted-foreground">
                                                (locked once a template exists)
                                            </span>
                                        )}
                                    </FormLabel>
                                    <Select
                                        onValueChange={field.onChange}
                                        value={field.value}
                                        disabled={isEdit}
                                    >
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="Initial">Initial</SelectItem>
                                            <SelectItem value="Final">Final</SelectItem>
                                        </SelectContent>
                                    </Select>
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

                        <FormField
                            control={form.control}
                            name="is_default_for_stage"
                            render={({ field }) => (
                                <FormItem className="flex items-center justify-between rounded-lg border p-3">
                                    <FormLabel className="!mt-0">
                                        Set as default template for {watchedStage} Interview
                                    </FormLabel>
                                    <FormControl>
                                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                                    </FormControl>
                                </FormItem>
                            )}
                        />

                        <Separator />

                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <h3 className="text-sm font-semibold">Criteria</h3>
                                <Badge variant={weightIsValid ? "default" : "destructive"} className="gap-1">
                                    {weightIsValid ? (
                                        <Check className="h-3 w-3" />
                                    ) : (
                                        <AlertTriangle className="h-3 w-3" />
                                    )}
                                    Total: {totalWeight}%
                                </Badge>
                            </div>

                            <div className="space-y-2">
                                {fields.map((field, index) => {
                                    const isLocked = Boolean(field.is_quiz_criterion);
                                    return (
                                        <div
                                            key={field.id}
                                            className="flex flex-col sm:flex-row sm:items-center gap-2 rounded-lg border p-2"
                                        >
                                            {isLocked && (
                                                <Lock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                            )}
                                            <FormField
                                                control={form.control}
                                                name={`criteria.${index}.name`}
                                                rules={{ required: "Required" }}
                                                render={({ field: nameField }) => (
                                                    <Input
                                                        {...nameField}
                                                        disabled={isLocked}
                                                        placeholder="Criterion name"
                                                        className="flex-1"
                                                    />
                                                )}
                                            />
                                            <FormField
                                                control={form.control}
                                                name={`criteria.${index}.weight_percentage`}
                                                render={({ field: weightField }) => (
                                                        <div className="relative w-full sm:w-24 shrink-0">
                                                        <Input
                                                            {...weightField}
                                                            type="number"
                                                            min={0}
                                                            max={100}
                                                            className="pr-6"
                                                        />
                                                        <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                                                            %
                                                        </span>
                                                    </div>
                                                )}
                                            />
                                            {!isLocked && (
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 shrink-0 text-muted-foreground"
                                                    onClick={() => remove(index)}
                                                >
                                                    <X className="h-4 w-4" />
                                                </Button>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>

                            {fields.length === 0 && (
                                <p className="text-sm text-muted-foreground">
                                    No criteria yet. Add at least one below.
                                </p>
                            )}

                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                    append({ name: "", weight_percentage: "0", is_quiz_criterion: false })
                                }
                            >
                                <Plus className="mr-1.5 h-3.5 w-3.5" />
                                Add Criterion
                            </Button>

                            {weightError && (
                                <p className="text-sm font-medium text-destructive">{weightError}</p>
                            )}
                        </div>

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={!weightIsValid}>
                                {isEdit ? "Update" : "Save"} Template
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
