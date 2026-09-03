"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { FileText } from "lucide-react";

import { Form } from "@/components/ui/form";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
    DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
    DEFAULT_APPLICATION_FORM,
    type ApplicationFormValues,
} from "@/modules/human-resource-management/application-form/types";
import { ApplicationDetailsSection } from "@/modules/human-resource-management/application-form/components/sections/ApplicationDetailsSection";
import { PersonalInfoSection } from "@/modules/human-resource-management/application-form/components/sections/PersonalInfoSection";
import { FamilyBackgroundSection } from "@/modules/human-resource-management/application-form/components/sections/FamilyBackgroundSection";
import { CompanyRelativesSection } from "@/modules/human-resource-management/application-form/components/sections/CompanyRelativesSection";
import { EducationSection } from "@/modules/human-resource-management/application-form/components/sections/EducationSection";
import { LicensureExamSection } from "@/modules/human-resource-management/application-form/components/sections/LicensureExamSection";
import { SkillsSection } from "@/modules/human-resource-management/application-form/components/sections/SkillsSection";
import { WorkExperienceSection } from "@/modules/human-resource-management/application-form/components/sections/WorkExperienceSection";
import { ReferencesSection } from "@/modules/human-resource-management/application-form/components/sections/ReferencesSection";
import { TrainingsSection } from "@/modules/human-resource-management/application-form/components/sections/TrainingsSection";
import { AttachmentsSection } from "@/modules/human-resource-management/application-form/components/sections/AttachmentsSection";
import {
    mapApplicationToFormValues,
    type ApplicationBundle,
} from "../utils/mapApplicationToFormValues";

interface ApplicationViewDialogProps {
    applicantId: number | null;
    applicantName: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

/**
 * Read-only application form viewer. Reuses the exact section components
 * from the application-form module inside a disabled fieldset — same
 * layout, zero edits to the source module. The certification section is
 * intentionally omitted (signature renders as a plain image block instead);
 * the stored photo UUID is converted to a File so the capture box shows it.
 */
export function ApplicationViewDialog({ applicantId, applicantName, open, onOpenChange }: ApplicationViewDialogProps) {
    const form = useForm<ApplicationFormValues>({ defaultValues: DEFAULT_APPLICATION_FORM });
    const [isLoading, setIsLoading] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [submittedAt, setSubmittedAt] = useState<string>("");
    const [signatureImage, setSignatureImage] = useState<string | null>(null);

    useEffect(() => {
        if (!open || applicantId === null) return;
        let cancelled = false;
        setIsLoading(true);
        setLoadError(null);
        fetch(`/api/hrm/applications/by-applicant?applicant_id=${applicantId}`)
            .then(async (res) => {
                const body = (await res.json()) as {
                    data?: ApplicationBundle & { application: Record<string, unknown> };
                    error?: string;
                };
                if (!res.ok) throw new Error(body.error || "Failed to load application.");
                if (!body.data || cancelled) return;
                form.reset(mapApplicationToFormValues(body.data));
                const photoUrl = (body.data as { photo_image?: unknown }).photo_image;
                if (typeof photoUrl === "string" && photoUrl.startsWith("data:")) {
                    try {
                        const blob = (await (await fetch(photoUrl)).blob()) as Blob;
                        form.setValue("photo_selected", new File([blob], "photo", { type: blob.type || "image/jpeg" }));
                    } catch {
                        form.setValue("photo_selected", null);
                    }
                }
                const sigUrl = (body.data as { signature_image?: unknown }).signature_image;
                setSignatureImage(typeof sigUrl === "string" && sigUrl.startsWith("data:") ? sigUrl : null);
                const raw = body.data.application["submitted_at"];
                setSubmittedAt(typeof raw === "string" ? raw.slice(0, 10) : "");
            })
            .catch((err: unknown) => {
                if (cancelled) return;
                const message = err instanceof Error ? err.message : "Failed to load application.";
                setLoadError(message);
                toast.error(message);
            })
            .finally(() => {
                if (!cancelled) setIsLoading(false);
            });
        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps -- fetch-once-per-open; form is stable
    }, [open, applicantId]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="w-[95vw] sm:max-w-[85vw] lg:max-w-[1000px] p-0 overflow-hidden border border-border/40 shadow-2xl bg-background rounded-2xl flex flex-col max-h-[90vh]">
                <div className="p-6 border-b border-border/40 bg-card">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-extrabold flex items-center gap-3">
                            <FileText className="h-5 w-5 text-muted-foreground" />
                            <span className="truncate" title={applicantName}>
                                {applicantName} — Application
                            </span>
                        </DialogTitle>
                        {submittedAt ? (
                            <DialogDescription className="text-sm mt-2">Submitted {submittedAt}</DialogDescription>
                        ) : null}
                    </DialogHeader>
                </div>

                <div className="p-6 md:p-8 flex-1 overflow-y-auto min-h-0">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                            <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin mb-4" />
                            <p className="text-sm animate-pulse">Loading application…</p>
                        </div>
                    ) : loadError ? (
                        <p className="text-sm text-destructive text-center py-16">{loadError}</p>
                    ) : (
                        <Form {...form}>
                            <fieldset disabled inert className="space-y-8">
                                <ApplicationDetailsSection form={form} />
                                <PersonalInfoSection form={form} />
                                <FamilyBackgroundSection form={form} />
                                <CompanyRelativesSection form={form} />
                                <EducationSection form={form} />
                                <LicensureExamSection form={form} />
                                <SkillsSection form={form} />
                                <WorkExperienceSection form={form} />
                                <ReferencesSection form={form} />
                                <TrainingsSection form={form} />
                                <AttachmentsSection form={form} />
                                {signatureImage ? (
                                    <div className="space-y-1.5">
                                        <p className="text-sm font-medium">Applicant Signature</p>
                                        <div className="flex items-center justify-center overflow-hidden rounded-md border bg-white p-2">
                                            {/* eslint-disable-next-line @next/next/no-img-element -- server-provided data URL, not a served asset */}
                                            <img src={signatureImage} alt="Applicant signature" className="max-h-32 object-contain" />
                                        </div>
                                    </div>
                                ) : null}
                            </fieldset>
                        </Form>
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
