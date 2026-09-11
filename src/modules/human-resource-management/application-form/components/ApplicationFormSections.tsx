"use client";

import type { RefObject } from "react";
import type { UseFormReturn } from "react-hook-form";
import { Separator } from "@/components/ui/separator";
import type { ApplicationFormValues } from "../types";
import type { SignaturePadHandle } from "./SignaturePad";
import { ApplicationDetailsSection } from "./sections/ApplicationDetailsSection";
import { PersonalInfoSection } from "./sections/PersonalInfoSection";
import { FamilyBackgroundSection } from "./sections/FamilyBackgroundSection";
import { CompanyRelativesSection } from "./sections/CompanyRelativesSection";
import { EducationSection } from "./sections/EducationSection";
import { LicensureExamSection } from "./sections/LicensureExamSection";
import { SkillsSection } from "./sections/SkillsSection";
import { WorkExperienceSection } from "./sections/WorkExperienceSection";
import { ReferencesSection } from "./sections/ReferencesSection";
import { TrainingsSection } from "./sections/TrainingsSection";
import { AttachmentsSection } from "./sections/AttachmentsSection";
import { CertificationSection } from "./sections/CertificationSection";

function SectionAnchor({ id, children }: { id: string; children: React.ReactNode }) {
    return (
        <section id={id} className="scroll-mt-28">
            {children}
        </section>
    );
}

export function ApplicationFormSections({
    form,
    sigRef,
}: {
    form: UseFormReturn<ApplicationFormValues>;
    sigRef: RefObject<SignaturePadHandle | null>;
}) {
    return (
        <>
            <SectionAnchor id="section-application">
                <ApplicationDetailsSection form={form} />
            </SectionAnchor>
            <Separator />
            <SectionAnchor id="section-personal">
                <PersonalInfoSection form={form} />
            </SectionAnchor>
            <Separator />
            <SectionAnchor id="section-family">
                <FamilyBackgroundSection form={form} />
            </SectionAnchor>
            <Separator />
            <SectionAnchor id="section-company">
                <CompanyRelativesSection form={form} />
            </SectionAnchor>
            <Separator />
            <SectionAnchor id="section-education">
                <EducationSection form={form} />
            </SectionAnchor>
            <SectionAnchor id="section-licensure">
                <LicensureExamSection form={form} />
            </SectionAnchor>
            <Separator />
            <SectionAnchor id="section-skills">
                <SkillsSection form={form} />
            </SectionAnchor>
            <Separator />
            <SectionAnchor id="section-work">
                <WorkExperienceSection form={form} />
            </SectionAnchor>
            <Separator />
            <SectionAnchor id="section-references">
                <ReferencesSection form={form} />
            </SectionAnchor>
            <Separator />
            <SectionAnchor id="section-trainings">
                <TrainingsSection form={form} />
            </SectionAnchor>
            <Separator />
            <SectionAnchor id="section-attachments">
                <AttachmentsSection form={form} />
            </SectionAnchor>
            <SectionAnchor id="section-certification">
                <CertificationSection form={form} sigRef={sigRef} />
            </SectionAnchor>
        </>
    );
}
