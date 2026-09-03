"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { useDebouncedCallback } from "use-debounce";
import { toast } from "sonner";
import { AlertCircle, RotateCcw } from "lucide-react";

import { Form } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";

import {
    CERTIFICATION_AGREEMENT_LINE,
    CERTIFICATION_CLAUSES,
    CERTIFICATION_HEADING,
    DEFAULT_APPLICATION_FORM,
    type ApplicationFormValues,
    type CompanyRelativeRow,
    type EducationLevel,
    type EducationRow,
    type FamilyMemberFields,
    type LicensureExamRow,
    type ReferenceRow,
    type SubmitApplicationPayload,
    type SubmitAttachment,
    type SubmitCompanyRelative,
    type SubmitEducation,
    type SubmitFamilyMember,
    type SubmitLicensureExam,
    type SubmitReference,
    type SubmitTraining,
    type SubmitWorkExperience,
    type TrainingRow,
    type WorkExperienceRow,
} from "./types";
import {
    resolveTargetQuizId,
    submitApplication,
    uploadApplicationFile,
} from "./providers/fetchProvider";
import { loadDraft, saveDraft, clearDraft, type StoredDraft } from "./lib/autosave";
import type { SignaturePadHandle } from "./components/SignaturePad";
import { ApplicationDetailsSection } from "./components/sections/ApplicationDetailsSection";
import { PersonalInfoSection } from "./components/sections/PersonalInfoSection";
import { FamilyBackgroundSection } from "./components/sections/FamilyBackgroundSection";
import { CompanyRelativesSection } from "./components/sections/CompanyRelativesSection";
import { EducationSection } from "./components/sections/EducationSection";
import { LicensureExamSection } from "./components/sections/LicensureExamSection";
import { SkillsSection } from "./components/sections/SkillsSection";
import { WorkExperienceSection } from "./components/sections/WorkExperienceSection";
import { ReferencesSection } from "./components/sections/ReferencesSection";
import { TrainingsSection } from "./components/sections/TrainingsSection";
import { AttachmentsSection } from "./components/sections/AttachmentsSection";
import { CertificationSection } from "./components/sections/CertificationSection";

const CERTIFICATION_SNAPSHOT = [CERTIFICATION_HEADING, ...CERTIFICATION_CLAUSES, CERTIFICATION_AGREEMENT_LINE].join(
    "\n\n"
);

// ============================================================================
// Payload assembly -- every mapper drops a row that's missing its anchor field
// rather than blocking submit (warn-don't-block, architecture sec 4 item 21).
// A row added-then-left-blank is silently not saved, not an error.
// ============================================================================

function toNumberOrNull(s: string): number | null {
    const trimmed = s.trim();
    if (!trimmed) return null;
    const n = Number(trimmed);
    return Number.isFinite(n) ? n : null;
}

function toStringOrNull(s: string): string | null {
    const trimmed = s.trim();
    return trimmed || null;
}

function isFamilyMemberFilled(m: FamilyMemberFields): boolean {
    return Boolean(m.name.trim() || m.occupation.trim() || m.company.trim() || m.age.trim() || m.education.trim());
}

function buildFamilyMembers(values: ApplicationFormValues): SubmitFamilyMember[] {
    const rows: SubmitFamilyMember[] = [];
    (["father", "mother", "spouse"] as const).forEach((key) => {
        if (key === "spouse" && values.civil_status === "Single") return;
        const m = values[key];
        if (!isFamilyMemberFilled(m)) return;
        rows.push({
            relation: key === "father" ? "Father" : key === "mother" ? "Mother" : "Spouse",
            name: m.name.trim(),
            age: toNumberOrNull(m.age),
            occupation: toStringOrNull(m.occupation),
            company: toStringOrNull(m.company),
            education: toStringOrNull(m.education),
        });
    });
    values.family_dependents.forEach((d) => {
        if (!d.relation || !d.name.trim()) return;
        rows.push({
            relation: d.relation,
            name: d.name.trim(),
            age: toNumberOrNull(d.age),
            occupation: toStringOrNull(d.occupation),
            company: toStringOrNull(d.company),
            education: toStringOrNull(d.education),
        });
    });
    return rows;
}

function buildCompanyRelatives(values: ApplicationFormValues): SubmitCompanyRelative[] {
    if (!values.has_company_relatives) return [];
    return values.company_relatives
        .filter((r: CompanyRelativeRow) => r.name.trim())
        .map((r) => ({
            name: r.name.trim(),
            relationship: toStringOrNull(r.relationship),
            position: toStringOrNull(r.position),
            area_assignment: toStringOrNull(r.area_assignment),
        }));
}

function buildEducation(rows: EducationRow[]): SubmitEducation[] {
    // application_education.level is NOT NULL -- a row without a level chosen
    // can't be saved, so it's dropped rather than blocking the whole submit.
    return rows
        .filter((r) => r.level)
        .map((r) => ({
            level: r.level as EducationLevel,
            school_name: toStringOrNull(r.school_name),
            school_address: toStringOrNull(r.school_address),
            date_from: toStringOrNull(r.date_from),
            date_to: toStringOrNull(r.date_to),
            degree_units_earned: toStringOrNull(r.degree_units_earned),
            honors_awards: toStringOrNull(r.honors_awards),
        }));
}

function buildLicensureExams(rows: LicensureExamRow[]): SubmitLicensureExam[] {
    return rows
        .filter((r) => r.examination.trim())
        .map((r) => ({
            examination: r.examination.trim(),
            date_taken: toStringOrNull(r.date_taken),
            rating: toStringOrNull(r.rating),
            result: toStringOrNull(r.result),
            inclusive_dates: toStringOrNull(r.inclusive_dates),
        }));
}

function buildWorkExperience(values: ApplicationFormValues): SubmitWorkExperience[] {
    if (values.is_fresh_graduate) return [];
    return values.work_experience
        .filter((r: WorkExperienceRow) => r.employer.trim())
        .map((r) => ({
            employer: r.employer.trim(),
            address: toStringOrNull(r.address),
            job_title: toStringOrNull(r.job_title),
            date_from: toStringOrNull(r.date_from),
            date_to: toStringOrNull(r.date_to),
            salary_rate_start: toNumberOrNull(r.salary_rate_start),
            salary_rate_end: toNumberOrNull(r.salary_rate_end),
            supervisor_name: toStringOrNull(r.supervisor_name),
            supervisor_contact: toStringOrNull(r.supervisor_contact),
            responsibilities: toStringOrNull(r.responsibilities),
            reason_for_leaving: toStringOrNull(r.reason_for_leaving),
        }));
}

function buildReferences(rows: ReferenceRow[]): SubmitReference[] {
    return rows
        .filter((r) => r.name.trim())
        .map((r) => ({
            name: r.name.trim(),
            title_occupation: toStringOrNull(r.title_occupation),
            company_name_address: toStringOrNull(r.company_name_address),
            contact_number: toStringOrNull(r.contact_number),
        }));
}

function buildTrainings(rows: TrainingRow[]): SubmitTraining[] {
    return rows
        .filter((r) => r.title_subject.trim())
        .map((r) => ({
            title_subject: r.title_subject.trim(),
            venue_location: toStringOrNull(r.venue_location),
            date_from: toStringOrNull(r.date_from),
            date_to: toStringOrNull(r.date_to),
        }));
}

export function ApplicationFormModule() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const form = useForm<ApplicationFormValues>({ defaultValues: DEFAULT_APPLICATION_FORM });
    const sigRef = useRef<SignaturePadHandle | null>(null);

    // Quiz Management's "Start" button on a specific quiz row opens this form
    // with ?quiz_id=<that row>. When present it's the continuity target
    // directly (as long as it's still active); when absent (e.g. reached via
    // the sidebar with no quiz in mind), fall back to whichever quiz is
    // flagged "Applicant Quiz" -- see resolveTargetQuizId.
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
        // quizIdOverride is derived fresh from searchParams every render, not a
        // stable dep -- re-resolving on searchParams change is what we want.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchParams]);

    // localStorage doesn't exist during SSR, so `draftPrompt` must start at
    // `null` on both server and client and only pick up the real draft AFTER
    // hydration -- reading it eagerly (e.g. in a useState lazy initializer)
    // renders the "Resume draft?" banner on the client but not the
    // server-rendered HTML, which is exactly a hydration mismatch.
    useEffect(() => {
        setDraftPrompt(loadDraft());
    }, []);

    const debouncedSave = useDebouncedCallback((values: ApplicationFormValues) => {
        saveDraft(values);
    }, 800);

    // Whole-form reactive read (not form.watch()'s imperative subscription --
    // that form isn't React-Compiler-safe) so the debounced save just follows
    // along whenever anything changes.
    const watchedValues = useWatch({ control: form.control }) as ApplicationFormValues;
    useEffect(() => {
        debouncedSave(watchedValues);
    }, [watchedValues, debouncedSave]);

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
            return;
        }
        if (!values.signature_typed_mode && sigRef.current?.isEmpty()) {
            toast.error("Please provide a signature, or switch to typing your name.");
            return;
        }

        setSubmitting(true);
        try {
            // Upload every file BEFORE creating any DB row, so a failed upload
            // never leaves a half-created application behind.
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
                uploadedAttachments.push({ type: row.type, file: uuid, label: toStringOrNull(row.label) });
            }

            const payload: SubmitApplicationPayload = {
                position_applied_for: values.position_applied_for.trim(),
                how_heard: (values.how_heard || null) as SubmitApplicationPayload["how_heard"],
                how_heard_other:
                    values.how_heard === "Other" ? values.how_heard_other.trim() || null : null,

                first_name: values.first_name.trim(),
                middle_name: toStringOrNull(values.middle_name),
                last_name: values.last_name.trim(),
                nickname: toStringOrNull(values.nickname),
                address: toStringOrNull(values.address),
                phone: values.phone.trim(),
                email: toStringOrNull(values.email),
                birthdate: values.birthdate,
                birthplace: toStringOrNull(values.birthplace),
                sex: values.sex as SubmitApplicationPayload["sex"],
                height_cm: toNumberOrNull(values.height_cm),
                weight_kg: toNumberOrNull(values.weight_kg),
                civil_status: (values.civil_status || null) as SubmitApplicationPayload["civil_status"],
                religion: toStringOrNull(values.religion),
                sss_no: toStringOrNull(values.sss_no),
                tin: toStringOrNull(values.tin),
                philhealth_no: toStringOrNull(values.philhealth_no),
                pagibig_no: toStringOrNull(values.pagibig_no),
                drivers_license_no: toStringOrNull(values.drivers_license_no),
                photo_file: photoFile,

                family_members: buildFamilyMembers(values),
                has_company_relatives: values.has_company_relatives,
                company_relatives: buildCompanyRelatives(values),

                education: buildEducation(values.education),
                licensure_exams: buildLicensureExams(values.licensure_exams),

                special_skills: toStringOrNull(values.special_skills),
                languages: toStringOrNull(values.languages),
                organizational_affiliations: toStringOrNull(values.organizational_affiliations),
                hobbies_interests: toStringOrNull(values.hobbies_interests),

                work_experience: buildWorkExperience(values),
                references: buildReferences(values.references),
                trainings: buildTrainings(values.trainings),
                attachments: uploadedAttachments,

                certification_agreed: true,
                certification_text_snapshot: CERTIFICATION_SNAPSHOT,
                signature_file: signatureFile,
            };

            const { applicant_id, application_id, warning } = await submitApplication(payload);

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
        <div className="mx-auto max-w-3xl px-4 py-8">
            <Card>
                <CardHeader>
                    <CardTitle>Employment Application</CardTitle>
                    <CardDescription>
                        Please fill in your details. An HR staff member is available if you need help.
                    </CardDescription>
                </CardHeader>
                <CardContent>
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
                            <ApplicationDetailsSection form={form} />
                            <Separator />
                            <PersonalInfoSection form={form} />
                            <Separator />
                            <FamilyBackgroundSection form={form} />
                            <Separator />
                            <CompanyRelativesSection form={form} />
                            <Separator />
                            <EducationSection form={form} />
                            <LicensureExamSection form={form} />
                            <Separator />
                            <SkillsSection form={form} />
                            <Separator />
                            <WorkExperienceSection form={form} />
                            <Separator />
                            <ReferencesSection form={form} />
                            <Separator />
                            <TrainingsSection form={form} />
                            <Separator />
                            <AttachmentsSection form={form} />

                            <CertificationSection form={form} sigRef={sigRef} />

                            <Button
                                type="submit"
                                className="w-full"
                                disabled={submitting || (quizChecked && !quizId)}
                            >
                                {submitting ? "Submitting..." : "Submit Application"}
                            </Button>
                        </form>
                    </Form>
                </CardContent>
            </Card>
        </div>
    );
}
