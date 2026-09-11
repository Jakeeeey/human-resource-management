import {
    CERTIFICATION_AGREEMENT_LINE,
    CERTIFICATION_CLAUSES,
    CERTIFICATION_HEADING,
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
} from "../types";
import { checkDateOrder, checkPastDate } from "./softValidation";

/** Frozen copy of the certification text captured at submission time. */
export const CERTIFICATION_SNAPSHOT = [
    CERTIFICATION_HEADING,
    ...CERTIFICATION_CLAUSES,
    CERTIFICATION_AGREEMENT_LINE,
].join("\n\n");

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

/**
 * Cross-field date sanity check (ordering + not-in-the-future).
 * Returns a human message naming the section/row, or null when everything passes.
 */
export function checkSectionDateRanges(values: ApplicationFormValues): string | null {
    const ranged: { label: string; rows: { date_from: string; date_to: string }[] }[] = [
        { label: "Education", rows: values.education },
        ...(values.is_fresh_graduate ? [] : [{ label: "Work experience", rows: values.work_experience }]),
        { label: "Trainings", rows: values.trainings },
    ];
    for (const section of ranged) {
        for (let i = 0; i < section.rows.length; i++) {
            const row = section.rows[i];
            const orderErr = checkDateOrder(row.date_from, row.date_to);
            if (orderErr) return `${section.label} entry #${i + 1}: ${orderErr}`;
        }
    }
    for (let i = 0; i < values.licensure_exams.length; i++) {
        const row = values.licensure_exams[i];
        if (!row.examination.trim()) continue;
        const pastErr = checkPastDate(row.date_taken, "Date taken");
        if (pastErr) return `Licensure exam entry #${i + 1}: ${pastErr}`;
    }
    return null;
}

interface PayloadExtras {
    signatureFile: string | null;
    photoFile: string | null;
    uploadedAttachments: SubmitAttachment[];
}

/** Maps form state + uploaded file UUIDs into the API submission payload. */
export function buildSubmitPayload(
    values: ApplicationFormValues,
    extras: PayloadExtras
): SubmitApplicationPayload {
    return {
        position_applied_for: values.position_applied_for.trim(),
        how_heard: (values.how_heard || null) as SubmitApplicationPayload["how_heard"],
        how_heard_other: values.how_heard === "Other" ? values.how_heard_other.trim() || null : null,

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
        photo_file: extras.photoFile,

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
        attachments: extras.uploadedAttachments,

        certification_agreed: true,
        certification_text_snapshot: CERTIFICATION_SNAPSHOT,
        signature_file: extras.signatureFile,
    };
}
