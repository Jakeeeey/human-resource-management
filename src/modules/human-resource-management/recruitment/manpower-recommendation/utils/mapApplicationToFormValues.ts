import {
    DEFAULT_APPLICATION_FORM,
    type ApplicationFormValues,
    type AttachmentType,
    type CompanyRelativeRow,
    type EducationRow,
    type FamilyDependentRow,
    type FamilyMemberFields,
    type LicensureExamRow,
    type ReferenceRow,
    type TrainingRow,
    type WorkExperienceRow,
} from "@/modules/human-resource-management/application-form/types";

// ============================================================================
// Directus row bundle (GET /api/hrm/applications/by-applicant) →
// ApplicationFormValues. Inverse of the submit mapping in
// app/api/hrm/application-form/route.ts. Read-only viewer use only.
// ============================================================================

type Row = Record<string, unknown>;

export interface ApplicationBundle {
    application: Row;
    application_family_member?: Row[];
    application_company_relative?: Row[];
    application_education?: Row[];
    application_licensure_exam?: Row[];
    application_work_experience?: Row[];
    application_reference?: Row[];
    application_training?: Row[];
    application_attachment?: Row[];
}

/** DB scalar (string | number | null) → form string. */
function s(v: unknown): string {
    if (v === null || v === undefined) return "";
    if (typeof v === "number") return Number.isFinite(v) ? String(v) : "";
    return String(v);
}

/** ISO datetime → yyyy-mm-dd for date inputs. */
function d(v: unknown): string {
    const str = s(v);
    return str.length >= 10 ? str.slice(0, 10) : str;
}

function emptyMember(): FamilyMemberFields {
    return { name: "", age: "", occupation: "", company: "", education: "" };
}

function toMember(r: Row): FamilyMemberFields {
    return {
        name: s(r["name"]),
        age: s(r["age"]),
        occupation: s(r["occupation"]),
        company: s(r["company"]),
        education: s(r["education"]),
    };
}

function toCompanyRelative(r: Row): CompanyRelativeRow {
    return {
        name: s(r["name"]),
        relationship: s(r["relationship"]),
        position: s(r["position"]),
        area_assignment: s(r["area_assignment"]),
    };
}

function toEducation(r: Row): EducationRow {
    return {
        level: (s(r["level"]) || "") as EducationRow["level"],
        school_name: s(r["school_name"]),
        school_address: s(r["school_address"]),
        date_from: s(r["date_from"]),
        date_to: s(r["date_to"]),
        degree_units_earned: s(r["degree_units_earned"]),
        honors_awards: s(r["honors_awards"]),
    };
}

function toLicensure(r: Row): LicensureExamRow {
    return {
        examination: s(r["examination"]),
        date_taken: s(r["date_taken"]),
        rating: s(r["rating"]),
        result: s(r["result"]),
        inclusive_dates: s(r["inclusive_dates"]),
    };
}

function toWorkExperience(r: Row): WorkExperienceRow {
    return {
        employer: s(r["employer"]),
        address: s(r["address"]),
        job_title: s(r["job_title"]),
        date_from: s(r["date_from"]),
        date_to: s(r["date_to"]),
        salary_rate_start: s(r["salary_rate_start"]),
        salary_rate_end: s(r["salary_rate_end"]),
        supervisor_name: s(r["supervisor_name"]),
        supervisor_contact: s(r["supervisor_contact"]),
        responsibilities: s(r["responsibilities"]),
        reason_for_leaving: s(r["reason_for_leaving"]),
    };
}

function toReference(r: Row): ReferenceRow {
    return {
        name: s(r["name"]),
        title_occupation: s(r["title_occupation"]),
        company_name_address: s(r["company_name_address"]),
        contact_number: s(r["contact_number"]),
    };
}

function toTraining(r: Row): TrainingRow {
    return {
        title_subject: s(r["title_subject"]),
        venue_location: s(r["venue_location"]),
        date_from: s(r["date_from"]),
        date_to: s(r["date_to"]),
    };
}

const ATTACHMENT_TYPES: AttachmentType[] = ["Resume", "Transcript", "Government ID", "Certificate", "Other"];

export function mapApplicationToFormValues(bundle: ApplicationBundle): ApplicationFormValues {
    const a = bundle.application;

    // Fixed family blocks (Father/Mother/Spouse) vs repeating dependents.
    const father = emptyMember();
    const mother = emptyMember();
    const spouse = emptyMember();
    const family_dependents: FamilyDependentRow[] = [];
    for (const r of bundle.application_family_member ?? []) {
        const relation = s(r["relation"]);
        if (relation === "Father") Object.assign(father, toMember(r));
        else if (relation === "Mother") Object.assign(mother, toMember(r));
        else if (relation === "Spouse") Object.assign(spouse, toMember(r));
        else
            family_dependents.push({
                relation: (relation || "") as FamilyDependentRow["relation"],
                ...toMember(r),
            });
    }

    return {
        position_applied_for: s(a["position_applied_for"]),
        how_heard: (s(a["how_heard"]) || "") as ApplicationFormValues["how_heard"],
        how_heard_other: s(a["how_heard_other"]),

        first_name: s(a["first_name"]),
        middle_name: s(a["middle_name"]),
        last_name: s(a["last_name"]),
        nickname: s(a["nickname"]),
        address: s(a["address"]),
        phone: s(a["phone"]),
        email: s(a["email"]),
        birthdate: d(a["birthdate"]),
        birthplace: s(a["birthplace"]),
        sex: (s(a["sex"]) || "") as ApplicationFormValues["sex"],
        height_cm: s(a["height_cm"]),
        weight_kg: s(a["weight_kg"]),
        civil_status: (s(a["civil_status"]) || "") as ApplicationFormValues["civil_status"],
        religion: s(a["religion"]),
        sss_no: s(a["sss_no"]),
        tin: s(a["tin"]),
        philhealth_no: s(a["philhealth_no"]),
        pagibig_no: s(a["pagibig_no"]),
        drivers_license_no: s(a["drivers_license_no"]),
        // Viewer overrides this with a File built from the server-provided
        // photo data URL when one exists; null = "No photo" box.
        photo_selected: null,

        father,
        mother,
        spouse,
        family_dependents,

        has_company_relatives: a["has_company_relatives"] === true,
        company_relatives: (bundle.application_company_relative ?? []).map(toCompanyRelative),

        education: (bundle.application_education ?? []).map(toEducation),
        licensure_exams: (bundle.application_licensure_exam ?? []).map(toLicensure),

        special_skills: s(a["special_skills"]),
        languages: s(a["languages"]),
        organizational_affiliations: s(a["organizational_affiliations"]),
        hobbies_interests: s(a["hobbies_interests"]),

        is_fresh_graduate: false,
        work_experience: (bundle.application_work_experience ?? []).map(toWorkExperience),

        references: (bundle.application_reference ?? []).map(toReference),

        trainings: (bundle.application_training ?? []).map(toTraining),

        // Stored file UUIDs can't rehydrate File objects — the viewer renders
        // its own read-only file list from attachment_files instead of this section.
        attachments: (bundle.application_attachment ?? []).map((r) => ({
            type: (ATTACHMENT_TYPES.includes(r["type"] as AttachmentType)
                ? r["type"]
                : "Resume") as AttachmentType,
            label: s(r["label"]),
            file: null,
        })),

        signature_typed_mode: false,
        signature_typed_name: "",
        certification_agreed: false,
    };
}

export { DEFAULT_APPLICATION_FORM };
