"use client";

import React, { useEffect, useRef, useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import type {
    QuestionType,
    QuizQuestionWithOptions,
    QuizQuestionFormData,
} from "../types";
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Plus, Trash2, Upload, X } from "lucide-react";
import Image from "next/image";
import { toast } from "sonner";

interface ExpectedAnswerBlank {
    answers: string[];
}

interface FormData {
    question_type: QuestionType;
    question_text: string;
    category: string;
    question_image: string | null;
    options: { option_text: string; option_image: string | null; is_correct: boolean }[];
    expectedAnswers: ExpectedAnswerBlank[];
}

const CHOICE_TYPES = new Set<QuestionType>(["true_false", "multiple_choice"]);

const TRUE_FALSE_DEFAULT: FormData["options"] = [
    { option_text: "True", option_image: null, is_correct: true },
    { option_text: "False", option_image: null, is_correct: false },
];

const MULTIPLE_CHOICE_DEFAULT: FormData["options"] = [
    { option_text: "", option_image: null, is_correct: true },
    { option_text: "", option_image: null, is_correct: false },
];

const BLANK_MARKER = /___/g;

function countBlanks(text: string): number {
    return (text.match(BLANK_MARKER) || []).length;
}

function defaultOptionsFor(type: QuestionType): FormData["options"] {
    if (type === "true_false") return TRUE_FALSE_DEFAULT.map((o) => ({ ...o }));
    if (type === "multiple_choice") return MULTIPLE_CHOICE_DEFAULT.map((o) => ({ ...o }));
    return [];
}

function defaultExpectedAnswersFor(
    type: QuestionType,
    questionText = ""
): FormData["expectedAnswers"] {
    if (type === "identification") return [{ answers: [""] }];
    if (type === "fill_in_the_blank") {
        return Array.from({ length: countBlanks(questionText) }, () => ({ answers: [""] }));
    }
    return [];
}

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

interface QuestionDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    question?: QuizQuestionWithOptions | null;
    onSubmit: (data: QuizQuestionFormData) => Promise<void>;
}

export function QuestionDialog({
    open,
    onOpenChange,
    question,
    onSubmit,
}: QuestionDialogProps) {
    const isEdit = !!question;

    const [isUploading, setIsUploading] = useState(false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [optionImagePreviews, setOptionImagePreviews] = useState<Record<number, string>>({});
    const optionImageFilesRef = useRef<Record<number, File>>({});
    const optionFileInputsRef = useRef<Record<number, HTMLInputElement | null>>({});

    const form = useForm<FormData>({
        defaultValues: {
            question_type: "true_false",
            question_text: "",
            category: "",
            question_image: null,
            options: defaultOptionsFor("true_false"),
            expectedAnswers: [],
        },
    });

    const { fields, append, remove, replace } = useFieldArray({
        control: form.control,
        name: "options",
    });

    const {
        fields: blankFields,
        append: appendBlank,
        remove: removeBlank,
        replace: replaceBlanks,
    } = useFieldArray({
        control: form.control,
        name: "expectedAnswers",
    });

    const questionType = form.watch("question_type");
    const questionText = form.watch("question_text");
    const options = form.watch("options");

    const correctIndex = options?.findIndex((o) => o?.is_correct) ?? -1;

    useEffect(() => {
        if (questionType !== "fill_in_the_blank") return;
        const blankCount = countBlanks(questionText || "");
        if (blankCount > blankFields.length) {
            const additions = Array.from({ length: blankCount - blankFields.length }, () => ({
                answers: [""],
            }));
            appendBlank(additions);
        } else if (blankCount < blankFields.length) {
            const toRemove = Array.from(
                { length: blankFields.length - blankCount },
                (_, i) => blankCount + i
            );
            removeBlank(toRemove);
        }
    }, [questionType, questionText]);

    useEffect(() => {
        if (open && question) {
            const isChoiceType = CHOICE_TYPES.has(question.question_type);
            form.reset({
                question_type: question.question_type,
                question_text: question.question_text,
                category: question.category || "",
                question_image: question.question_image || null,
                options: isChoiceType
                    ? question.options.length
                        ? question.options.map((o) => ({
                              option_text: o.option_text ?? "",
                              option_image: o.option_image ?? null,
                              is_correct: o.is_correct,
                          }))
                        : defaultOptionsFor(question.question_type)
                    : [],
                expectedAnswers: !isChoiceType
                    ? question.expectedAnswersByBlank.length
                        ? question.expectedAnswersByBlank.map((answers) => ({
                              answers: answers.length ? answers : [""],
                          }))
                        : defaultExpectedAnswersFor(question.question_type, question.question_text)
                    : [],
            });
            setSelectedFile(null);
            resetOptionImages();
            setImagePreview(
                question.question_image
                    ? `${process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8055"}/assets/${question.question_image}`
                    : null
            );
        } else if (!open) {
            form.reset({
                question_type: "true_false",
                question_text: "",
                category: "",
                question_image: null,
                options: defaultOptionsFor("true_false"),
                expectedAnswers: [],
            });
            setSelectedFile(null);
            setImagePreview(null);
            resetOptionImages();
        }
    }, [open, question, form]);

    const handleTypeChange = (value: QuestionType) => {
        form.setValue("question_type", value);
        resetOptionImages();
        if (CHOICE_TYPES.has(value)) {
            replaceBlanks([]);
            replace(defaultOptionsFor(value));
        } else {
            replace([]);
            replaceBlanks(defaultExpectedAnswersFor(value, form.getValues("question_text")));
        }
    };

    const addSynonym = (blankIndex: number) => {
        const current = form.getValues(`expectedAnswers.${blankIndex}.answers`) || [];
        form.setValue(`expectedAnswers.${blankIndex}.answers`, [...current, ""]);
    };

    const removeSynonym = (blankIndex: number, synonymIndex: number) => {
        const current = form.getValues(`expectedAnswers.${blankIndex}.answers`) || [];
        form.setValue(
            `expectedAnswers.${blankIndex}.answers`,
            current.filter((_, i) => i !== synonymIndex)
        );
    };

    const validateAndSetFile = (file: File) => {
        if (file.size > MAX_FILE_SIZE) {
            toast.error(
                `File too large. Maximum size is 5 MB (got ${(file.size / 1024 / 1024).toFixed(2)} MB)`
            );
            return;
        }
        if (!ALLOWED_TYPES.includes(file.type)) {
            toast.error("Invalid file type. Allowed: JPEG, PNG, WebP, GIF");
            return;
        }
        setSelectedFile(file);
        const reader = new FileReader();
        reader.onload = (e) => setImagePreview(e.target?.result as string);
        reader.readAsDataURL(file);
    };

    const clearImage = () => {
        setSelectedFile(null);
        setImagePreview(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
        form.setValue("question_image", null);
    };

    // --- per-option images (multiple choice) ---
    const setOptionImageFile = (i: number, file: File) => {
        if (file.size > MAX_FILE_SIZE) {
            toast.error(
                `File too large. Maximum size is 5 MB (got ${(file.size / 1024 / 1024).toFixed(2)} MB)`
            );
            return;
        }
        if (!ALLOWED_TYPES.includes(file.type)) {
            toast.error("Invalid file type. Allowed: JPEG, PNG, WebP, GIF");
            return;
        }
        optionImageFilesRef.current[i] = file;
        const reader = new FileReader();
        reader.onload = (e) =>
            setOptionImagePreviews((p) => ({ ...p, [i]: e.target?.result as string }));
        reader.readAsDataURL(file);
    };

    const clearOptionImage = (i: number) => {
        delete optionImageFilesRef.current[i];
        setOptionImagePreviews((p) => {
            const next = { ...p };
            delete next[i];
            return next;
        });
        form.setValue(`options.${i}.option_image`, null);
    };

    const resetOptionImages = () => {
        optionImageFilesRef.current = {};
        setOptionImagePreviews({});
    };

    const handleSubmit = async (data: FormData) => {
        try {
            setIsUploading(true);
            let questionImage = data.question_image;

            if (selectedFile) {
                const uploadForm = new FormData();
                uploadForm.append("file", selectedFile);

                const uploadRes = await fetch(
                    "/api/hrm/quiz-file-management/file-management/question-image-upload",
                    { method: "POST", body: uploadForm }
                );
                const uploadResult = await uploadRes.json();

                if (!uploadRes.ok) {
                    throw new Error(uploadResult.error || "Image upload failed");
                }
                questionImage = uploadResult.data?.id || null;
            }

            // Resolve any per-option images to their uploaded UUIDs, then require
            // that every choice carries text or an image.
            let options = data.options;
            if (CHOICE_TYPES.has(data.question_type)) {
                options = await Promise.all(
                    data.options.map(async (opt, i) => {
                        const file = optionImageFilesRef.current[i];
                        if (!file) return opt;
                        const fd = new FormData();
                        fd.append("file", file);
                        const res = await fetch(
                            "/api/hrm/quiz-file-management/file-management/question-image-upload",
                            { method: "POST", body: fd }
                        );
                        const result = await res.json();
                        if (!res.ok) {
                            throw new Error(result.error || `Option ${i + 1} image upload failed`);
                        }
                        return { ...opt, option_image: result.data?.id || null };
                    })
                );

                const missing = options.findIndex(
                    (o) => !o.option_text.trim() && !o.option_image
                );
                if (missing >= 0) {
                    toast.error(`Option ${missing + 1} needs text or an image.`);
                    setIsUploading(false);
                    return;
                }
            }

            await onSubmit({
                ...data,
                options,
                question_image: questionImage,
                category: data.category || null,
            });
            onOpenChange(false);
            form.reset();
            resetOptionImages();
        } catch (error) {
            console.error("Error submitting question:", error);
            toast.error(error instanceof Error ? error.message : "Failed to save question");
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[560px] max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{isEdit ? "Edit Question" : "Add Question"}</DialogTitle>
                    <DialogDescription>
                        {isEdit
                            ? "Update this question in the pool."
                            : "Add a new question to the shared quiz question pool."}
                    </DialogDescription>
                </DialogHeader>

                <Form {...form}>
                    <form
                        onSubmit={form.handleSubmit(handleSubmit)}
                        className="space-y-4"
                    >
                        <FormField
                            control={form.control}
                            name="question_type"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Question Type</FormLabel>
                                    <Select
                                        onValueChange={(v) => handleTypeChange(v as QuestionType)}
                                        value={field.value}
                                    >
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select a question type" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="true_false">True / False</SelectItem>
                                            <SelectItem value="multiple_choice">Multiple Choice</SelectItem>
                                            <SelectItem value="identification">Identification</SelectItem>
                                            <SelectItem value="fill_in_the_blank">
                                                Fill in the Blank
                                            </SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="question_text"
                            rules={{ required: "Question text is required" }}
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Question</FormLabel>
                                    <FormControl>
                                        <Textarea
                                            placeholder={
                                                questionType === "fill_in_the_blank"
                                                    ? "e.g. The ___ is the powerhouse of the ___."
                                                    : "Enter the question text"
                                            }
                                            {...field}
                                        />
                                    </FormControl>
                                    {questionType === "fill_in_the_blank" && (
                                        <FormDescription>
                                            Type <code className="rounded bg-muted px-1">___</code>{" "}
                                            (three underscores) wherever you want a blank —
                                            answer fields below will match automatically.
                                        </FormDescription>
                                    )}
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="category"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Category (optional)</FormLabel>
                                    <FormControl>
                                        <Input placeholder="e.g. Safety, Onboarding" {...field} />
                                    </FormControl>
                                    <FormDescription>
                                        Groups questions in the pool so a quiz can be set to draw
                                        only from selected categories.
                                    </FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormItem>
                            <FormLabel>Question Image (optional)</FormLabel>
                            <div
                                onClick={() => fileInputRef.current?.click()}
                                onDrop={(e) => {
                                    e.preventDefault();
                                    setIsDragging(false);
                                    const file = e.dataTransfer.files[0];
                                    if (file) validateAndSetFile(file);
                                }}
                                onDragOver={(e) => {
                                    e.preventDefault();
                                    setIsDragging(true);
                                }}
                                onDragLeave={() => setIsDragging(false)}
                                className={`relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-4 cursor-pointer transition-colors ${
                                    isDragging
                                        ? "border-primary bg-primary/5"
                                        : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50"
                                }`}
                            >
                                {imagePreview ? (
                                    <div className="relative">
                                        <Image
                                            src={imagePreview}
                                            alt="Question image preview"
                                            width={120}
                                            height={120}
                                            className="h-[120px] w-[120px] rounded-lg object-contain aspect-square bg-white dark:bg-slate-950 border"
                                            unoptimized
                                        />
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                clearImage();
                                            }}
                                            className="absolute -top-2 -right-2 rounded-full bg-destructive p-1.5 text-destructive-foreground hover:bg-destructive/80 shadow-sm"
                                        >
                                            <X className="h-4 w-4" />
                                        </button>
                                    </div>
                                ) : (
                                    <>
                                        <div className="rounded-full bg-muted p-3 mb-2">
                                            <Upload className="h-5 w-5 text-muted-foreground" />
                                        </div>
                                        <p className="text-sm font-medium">Click or drag to upload</p>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            JPEG, PNG, WebP, GIF up to 5MB
                                        </p>
                                    </>
                                )}
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/jpeg,image/png,image/webp,image/gif"
                                    className="hidden"
                                    onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) validateAndSetFile(file);
                                    }}
                                />
                            </div>
                        </FormItem>

                        {questionType === "true_false" && (
                            <FormItem>
                                <FormLabel>Correct Answer</FormLabel>
                                <RadioGroup
                                    value={correctIndex.toString()}
                                    onValueChange={(v) => {
                                        const idx = Number(v);
                                        fields.forEach((_, i) =>
                                            form.setValue(`options.${i}.is_correct`, i === idx)
                                        );
                                    }}
                                    className="flex gap-6"
                                >
                                    {fields.map((f, i) => (
                                        <div key={f.id} className="flex items-center gap-2">
                                            <RadioGroupItem value={i.toString()} id={`tf-${i}`} />
                                            <label htmlFor={`tf-${i}`}>{f.option_text}</label>
                                        </div>
                                    ))}
                                </RadioGroup>
                            </FormItem>
                        )}

                        {questionType === "identification" && (
                            <FormItem>
                                <FormLabel>Correct Answer(s)</FormLabel>
                                <FormDescription>
                                    Add every accepted variant -- e.g. &quot;Manila&quot; and
                                    &quot;City of Manila&quot; can both be marked correct.
                                </FormDescription>
                                <div className="space-y-2">
                                    {(form.watch("expectedAnswers.0.answers") || []).map((_, synIndex) => (
                                        <FormField
                                            key={synIndex}
                                            control={form.control}
                                            name={`expectedAnswers.0.answers.${synIndex}`}
                                            rules={{ required: "Answer is required" }}
                                            render={({ field }) => (
                                                <div className="flex items-center gap-2">
                                                    <Input
                                                        placeholder="Accepted answer"
                                                        {...field}
                                                        className="flex-1"
                                                    />
                                                    {(form.watch("expectedAnswers.0.answers")?.length ?? 0) >
                                                        1 && (
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => removeSynonym(0, synIndex)}
                                                        >
                                                            <Trash2 className="h-4 w-4 text-destructive" />
                                                        </Button>
                                                    )}
                                                </div>
                                            )}
                                        />
                                    ))}
                                </div>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => addSynonym(0)}
                                >
                                    <Plus className="mr-1 h-3 w-3" />
                                    Add Accepted Variant
                                </Button>
                            </FormItem>
                        )}

                        {questionType === "fill_in_the_blank" && (
                            <FormItem>
                                <FormLabel>
                                    Blank Answers {blankFields.length === 0 && "(add ___ above first)"}
                                </FormLabel>
                                <FormDescription>
                                    Add every accepted variant for each blank.
                                </FormDescription>
                                <div className="space-y-4">
                                    {blankFields.map((blankField, blankIndex) => (
                                        <div
                                            key={blankField.id}
                                            className="space-y-2 rounded-md border p-3"
                                        >
                                            <span className="text-sm font-medium text-muted-foreground">
                                                Blank {blankIndex + 1}
                                            </span>
                                            {(
                                                form.watch(`expectedAnswers.${blankIndex}.answers`) || []
                                            ).map((_, synIndex) => (
                                                <FormField
                                                    key={synIndex}
                                                    control={form.control}
                                                    name={`expectedAnswers.${blankIndex}.answers.${synIndex}`}
                                                    rules={{ required: "Answer is required" }}
                                                    render={({ field }) => (
                                                        <div className="flex items-center gap-2">
                                                            <Input
                                                                placeholder="Accepted answer"
                                                                {...field}
                                                                className="flex-1"
                                                            />
                                                            {(form.watch(
                                                                `expectedAnswers.${blankIndex}.answers`
                                                            )?.length ?? 0) > 1 && (
                                                                <Button
                                                                    type="button"
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    onClick={() =>
                                                                        removeSynonym(blankIndex, synIndex)
                                                                    }
                                                                >
                                                                    <Trash2 className="h-4 w-4 text-destructive" />
                                                                </Button>
                                                            )}
                                                        </div>
                                                    )}
                                                />
                                            ))}
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={() => addSynonym(blankIndex)}
                                            >
                                                <Plus className="mr-1 h-3 w-3" />
                                                Add Accepted Variant
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            </FormItem>
                        )}

                        {questionType === "multiple_choice" && (
                            <FormItem>
                                <div className="flex items-center justify-between">
                                    <FormLabel>Options</FormLabel>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() =>
                                            append({ option_text: "", option_image: null, is_correct: false })
                                        }
                                    >
                                        <Plus className="mr-1 h-3 w-3" />
                                        Add Option
                                    </Button>
                                </div>
                                <FormDescription>
                                    Each option needs text, an image, or both.
                                </FormDescription>
                                <RadioGroup
                                    value={correctIndex.toString()}
                                    onValueChange={(v) => {
                                        const idx = Number(v);
                                        fields.forEach((_, i) =>
                                            form.setValue(`options.${i}.is_correct`, i === idx)
                                        );
                                    }}
                                    className="space-y-3"
                                >
                                    {fields.map((f, i) => {
                                        const existingUuid = form.watch(`options.${i}.option_image`);
                                        const preview =
                                            optionImagePreviews[i] ||
                                            (existingUuid
                                                ? `${process.env.NEXT_PUBLIC_API_BASE_URL || ""}/assets/${existingUuid}`
                                                : null);
                                        return (
                                            <div key={f.id} className="flex items-start gap-2">
                                                <RadioGroupItem
                                                    value={i.toString()}
                                                    id={`mc-${i}`}
                                                    className="mt-2.5"
                                                />
                                                <div className="flex-1 space-y-2">
                                                    <FormField
                                                        control={form.control}
                                                        name={`options.${i}.option_text`}
                                                        render={({ field }) => (
                                                            <Input
                                                                placeholder={`Option ${i + 1} — text (optional if image)`}
                                                                {...field}
                                                            />
                                                        )}
                                                    />
                                                    <div className="flex items-center gap-2">
                                                        {preview ? (
                                                            <div className="relative">
                                                                <Image
                                                                    src={preview}
                                                                    alt={`Option ${i + 1}`}
                                                                    width={48}
                                                                    height={48}
                                                                    unoptimized
                                                                    className="h-12 w-12 rounded border object-contain bg-white dark:bg-slate-950"
                                                                />
                                                                <button
                                                                    type="button"
                                                                    onClick={() => clearOptionImage(i)}
                                                                    className="absolute -right-1.5 -top-1.5 rounded-full bg-destructive p-0.5 text-destructive-foreground"
                                                                >
                                                                    <X className="h-3 w-3" />
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <Button
                                                                type="button"
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={() =>
                                                                    optionFileInputsRef.current[i]?.click()
                                                                }
                                                            >
                                                                <Upload className="mr-1 h-3 w-3" />
                                                                Image
                                                            </Button>
                                                        )}
                                                        <input
                                                            ref={(el) => {
                                                                optionFileInputsRef.current[i] = el;
                                                            }}
                                                            type="file"
                                                            accept="image/jpeg,image/png,image/webp,image/gif"
                                                            className="hidden"
                                                            onChange={(e) => {
                                                                const file = e.target.files?.[0];
                                                                if (file) setOptionImageFile(i, file);
                                                            }}
                                                        />
                                                    </div>
                                                </div>
                                                {fields.length > 2 && (
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => remove(i)}
                                                    >
                                                        <Trash2 className="h-4 w-4 text-destructive" />
                                                    </Button>
                                                )}
                                            </div>
                                        );
                                    })}
                                </RadioGroup>
                            </FormItem>
                        )}

                        <DialogFooter>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => onOpenChange(false)}
                            >
                                Cancel
                            </Button>
                            <Button type="submit" disabled={isUploading}>
                                {isUploading
                                    ? "Saving..."
                                    : `${isEdit ? "Update" : "Create"} Question`}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
