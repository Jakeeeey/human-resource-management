"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { useDebouncedCallback } from "use-debounce";
import { toast } from "sonner";
import { AlertCircle, RotateCcw } from "lucide-react";

import { Form } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";

import {
    DEFAULT_APPLICATION_FORM,
    type ApplicationFormValues,
    type SubmitAttachment,
} from "./types";
import {
    resolveTargetQuizId,
    submitApplication,
    uploadApplicationFile,
} from "./providers/fetchProvider";
import { loadDraft, saveDraft, clearDraft, hasDraftContent, type StoredDraft } from "./lib/autosave";
import { checkBirthdate } from "./lib/softValidation";
import { buildSubmitPayload, checkSectionDateRanges } from "./lib/applicationPayload";
import type { SignaturePadHandle } from "./components/SignaturePad";
import { ApplicationFormSections } from "./components/ApplicationFormSections";
import { ApplicationFormNav, StickySubmitBar } from "./components/ApplicationFormNav";

export function ApplicationFormModule() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const form = useForm<ApplicationFormValues>({ defaultValues: DEFAULT_APPLICATION_FORM, mode: "onTouched" });
    const sigRef = useRef<SignaturePadHandle | null>(null);
    const submittedRef = useRef(false);

    const quizIdOverride = (() => {
        const raw = searchParams.get("quiz_id");
        const n = raw ? Number(raw) : NaN;
        return Number.isFinite(n) ? n : null;
    })();

    const [submitting, setSubmitting] = useState(false);
    const [quizId, setQuizId] = useState<number | null>(null);
    const [quizChecked, setQuizChecked] = useState(false);
    const [draftPrompt, setDraftPrompt] = useState<StoredDraft | null>(null);

    useEffect(() => {
        resolveTargetQuizId(quizIdOverride)
            .then(setQuizId)
            .finally(() => setQuizChecked(true));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchParams]);

    useEffect(() => {
        const draft = loadDraft();
        if (draft && hasDraftContent(draft.values)) {
            setDraftPrompt(draft);
        } else if (draft) {
            clearDraft();
        }
    }, []);

    const debouncedSave = useDebouncedCallback((values: ApplicationFormValues) => {
        saveDraft(values);
    }, 800);

    const watchedValues = useWatch({ control: form.control }) as ApplicationFormValues;
    const isDirty = form.formState.isDirty;
    useEffect(() => {
        if (submittedRef.current || !isDirty) return;
        debouncedSave(watchedValues);
    }, [watchedValues, isDirty, debouncedSave]);

    const resumeDraft = () => {
        if (!draftPrompt) return;
        form.reset({
            ...DEFAULT_APPLICATION_FORM,
            ...draftPrompt.values,
            photo_selected: null,
            attachments: draftPrompt.values.attachments.length
                ? draftPrompt.values.attachments.map((a) => ({ ...a, file: null }))
                : DEFAULT_APPLICATION_FORM.attachments,
        });
        setDraftPrompt(null);
    };

    const discardDraft = () => {
        clearDraft();
        setDraftPrompt(null);
    };

    const onValid = async (values: ApplicationFormValues) => {
        if (!quizId) {
            toast.error("No applicant quiz is configured. Ask HR to set one before continuing.");
            return;
        }
        const birthdateErr = checkBirthdate(values.birthdate);
        if (birthdateErr) {
            form.setError("birthdate", { message: birthdateErr });
            return;
        }
        const rangeErr = checkSectionDateRanges(values);
        if (rangeErr) {
            toast.error(rangeErr);
            return;
        }
        if (!values.certification_agreed) {
            form.setError("certification_agreed", { message: "You must read and agree before submitting." });
            return;
        }
        if (values.how_heard === "Other" && !values.how_heard_other.trim()) {
            form.setError("how_heard_other", { message: "Please specify." });
            return;
        }
        if (values.signature_typed_mode && !values.signature_typed_name.trim()) {
            form.setError("signature_typed_name", { message: "Type your name as your signature." });
            sigRef.current?.focus();
            return;
        }
        if (!values.signature_typed_mode && sigRef.current?.isEmpty()) {
            form.setError("signature_typed_name", {
                message: "Draw your signature, or switch to typing your name.",
            });
            sigRef.current?.focus();
            return;
        }

        setSubmitting(true);
        try {
            let signatureFile: string | null = null;
            if (!values.signature_typed_mode) {
                const blob = await sigRef.current?.exportBlob();
                if (blob) {
                    signatureFile = await uploadApplicationFile(blob, "signature", "signature.png");
                }
            }

            let photoFile: string | null = null;
            if (values.photo_selected) {
                photoFile = await uploadApplicationFile(
                    values.photo_selected,
                    "photo",
                    values.photo_selected.name
                );
            }

            const uploadedAttachments: SubmitAttachment[] = [];
            for (const row of values.attachments) {
                if (!row.file) continue;
                const uuid = await uploadApplicationFile(row.file, "attachment", row.file.name);
                uploadedAttachments.push({ type: row.type, file: uuid, label: row.label.trim() || null });
            }

            const payload = buildSubmitPayload(values, {
                signatureFile,
                photoFile,
                uploadedAttachments,
            });

            const { applicant_id, application_id, warning } = await submitApplication(payload);

            submittedRef.current = true;
            debouncedSave.cancel();
            clearDraft();
            if (warning) toast.warning(warning);
            toast.success("Application submitted. Starting the assessment...");
            router.push(
                `/apply/quiz?quiz_id=${quizId}&applicant_id=${applicant_id}&application_id=${application_id}`
            );
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Something went wrong. Please try again.");
            setSubmitting(false);
        }
    };

    return (
        <div className="mx-auto max-w-3xl lg:max-w-5xl px-4 py-8">
            <Card>
                <CardHeader>
                    <CardTitle>Employment Application</CardTitle>
                    <CardDescription>
                        Please fill in your details. An HR staff member is available if you need help.
                    </CardDescription>
                </CardHeader>
                <CardContent className="p-6">
                    {quizChecked && !quizId && (
                        <Alert variant="destructive" className="mb-4">
                            <AlertCircle className="h-4 w-4" />
                            <AlertTitle>Assessment not available</AlertTitle>
                            <AlertDescription>
                                No applicant quiz is configured yet. Please let the HR staff know before continuing.
                            </AlertDescription>
                        </Alert>
                    )}

                    {draftPrompt && (
                        <Alert className="mb-4">
                            <RotateCcw className="h-4 w-4" />
                            <AlertTitle>Resume unfinished application?</AlertTitle>
                            <AlertDescription>
                                <p className="mb-2">
                                    A draft was saved on this device at{" "}
                                    {new Date(draftPrompt.savedAt).toLocaleString()}.
                                </p>
                                <div className="flex gap-2">
                                    <Button type="button" size="sm" onClick={resumeDraft}>
                                        Resume
                                    </Button>
                                    <Button type="button" size="sm" variant="outline" onClick={discardDraft}>
                                        Start Fresh
                                    </Button>
                                </div>
                            </AlertDescription>
                        </Alert>
                    )}

                    <Form {...form}>
                        <form
                            onSubmit={(e) => {
                                e.preventDefault();
                                void form.handleSubmit(onValid)();
                            }}
                            className="space-y-8"
                        >
                            <ApplicationFormNav />

                            <p className="text-sm text-muted-foreground">
                                <span className="text-destructive">*</span> Required field
                            </p>

                            <ApplicationFormSections form={form} sigRef={sigRef} />

                            <StickySubmitBar
                                submitting={submitting}
                                disabled={submitting || (quizChecked && !quizId)}
                            />
                        </form>
                    </Form>
                </CardContent>
            </Card>
        </div>
    );
}
