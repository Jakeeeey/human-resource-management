// ============================================================================
// Application Form — Type Definitions (Stage 2: the full 9-section form)
// ============================================================================
// Schema/data-model reference: playbook-erp-human-resource-management-architecture.md
// sec 18. All fields added this stage are optional (warn-don't-block, sec 4
// item 21) -- the Stage-1 required set (first/last name, position, phone,
// birthdate, sex, certification) is unchanged.

export type Sex = "Male" | "Female";

export type HowHeard =
    | "Walk-In"
    | "Advertisement"
    | "Friend/Family"
    | "MEN2 Employee"
    | "Other";

export const HOW_HEARD_OPTIONS: HowHeard[] = [
    "Walk-In",
    "Advertisement",
    "Friend/Family",
    "MEN2 Employee",
    "Other",
];

export type CivilStatus = "Single" | "Married" | "Widowed" | "Separated" | "Divorced";

export const CIVIL_STATUS_OPTIONS: CivilStatus[] = [
    "Single",
    "Married",
    "Widowed",
    "Separated",
    "Divorced",
];

export type EducationLevel =
    | "Elementary"
    | "High School"
    | "Senior High School"
    | "Vocational"
    | "College"
    | "Post-Graduate";

export const EDUCATION_LEVEL_OPTIONS: EducationLevel[] = [
    "Elementary",
    "High School",
    "Senior High School",
    "Vocational",
    "College",
    "Post-Graduate",
];

// Father/Mother/Spouse are fixed single blocks (not part of this list); the
// repeating "Children / Other Dependents" list only offers these three.
export type DependentRelation = "Sibling" | "Child" | "Dependent";

export const DEPENDENT_RELATION_OPTIONS: DependentRelation[] = ["Sibling", "Child", "Dependent"];

export type AttachmentType = "Resume" | "Transcript" | "Government ID" | "Certificate" | "Other";

export const ATTACHMENT_TYPE_OPTIONS: AttachmentType[] = [
    "Resume",
    "Transcript",
    "Government ID",
    "Certificate",
    "Other",
];

// Transcribed verbatim from the paper "Men2 Corporation" application form's own
// "Applicant's Certification" section. Shown above the certification tick; the
// exact string is snapshotted onto application.certification_text_snapshot at
// submit so a later wording change never rewrites what a past applicant agreed
// to (same reasoning as answer_key_snapshot).
export const CERTIFICATION_HEADING =
    "Applicant's Certification – Please read this carefully before signing the application!";

export const CERTIFICATION_CLAUSES: string[] = [
    "I understand that completing this application will in no way assure that I will be employed by Men2 Corporation.",
    "I certify that I have answered truthfully and have not knowingly withheld information relative to my application.",
    "I understand that any misrepresentation or material omission on the application will result in my being eliminated from further consideration. I further understand that, if accepted for employment, any misrepresentation or material omission that becomes known to Men2 Corporation may result in immediate termination of my employment.",
    "I authorize investigation of all statements contained in this application for employment as may be necessary in arriving at an employment decision. Including but not limited to: previous employers, supervisors, schools, including all persons with and for whom I have worked or attended school, to give Men2 Corporation's representatives any and all information regarding me and my previous employment and schooling. I release Men2 Corporation and all previous employers, supervisors and schools from liability for any damage that may result from furnishing information to Men2 Corporation.",
    "In consideration of my employment, I agree to adhere to all existing and future instructions, rules and policies of Men2 Corporation. I also understand that Men2 Corporation reserves the right to change wages, hours and working conditions as deemed necessary.",
];

// The paper form's own agreement line, doubling as the checkbox label.
export const CERTIFICATION_AGREEMENT_LINE =
    "I have read, reviewed and explain to me all the above certification statements and other information provided on the application.";

// --- repeating / fixed-block row shapes (form-side: everything is a string,
// parsed on submit, matching the house pattern used in QuizSettingsDialog) ---

export interface FamilyMemberFields {
    name: string;
    age: string;
    occupation: string;
    company: string;
    education: string;
}

export const EMPTY_FAMILY_MEMBER: FamilyMemberFields = {
    name: "",
    age: "",
    occupation: "",
    company: "",
    education: "",
};

export interface FamilyDependentRow extends FamilyMemberFields {
    relation: "" | DependentRelation;
}

export const EMPTY_FAMILY_DEPENDENT: FamilyDependentRow = { relation: "", ...EMPTY_FAMILY_MEMBER };

export interface CompanyRelativeRow {
    name: string;
    relationship: string;
    position: string;
    area_assignment: string;
}

export const EMPTY_COMPANY_RELATIVE: CompanyRelativeRow = {
    name: "",
    relationship: "",
    position: "",
    area_assignment: "",
};

export interface EducationRow {
    level: "" | EducationLevel;
    school_name: string;
    school_address: string;
    date_from: string;
    date_to: string;
    degree_units_earned: string;
    honors_awards: string;
}

export const EMPTY_EDUCATION: EducationRow = {
    level: "",
    school_name: "",
    school_address: "",
    date_from: "",
    date_to: "",
    degree_units_earned: "",
    honors_awards: "",
};

export interface LicensureExamRow {
    examination: string;
    date_taken: string;
    rating: string;
    result: string;
    inclusive_dates: string;
}

export const EMPTY_LICENSURE_EXAM: LicensureExamRow = {
    examination: "",
    date_taken: "",
    rating: "",
    result: "",
    inclusive_dates: "",
};

export interface WorkExperienceRow {
    employer: string;
    address: string;
    job_title: string;
    date_from: string;
    date_to: string;
    salary_rate_start: string;
    salary_rate_end: string;
    supervisor_name: string;
    supervisor_contact: string;
    responsibilities: string;
    reason_for_leaving: string;
}

export const EMPTY_WORK_EXPERIENCE: WorkExperienceRow = {
    employer: "",
    address: "",
    job_title: "",
    date_from: "",
    date_to: "",
    salary_rate_start: "",
    salary_rate_end: "",
    supervisor_name: "",
    supervisor_contact: "",
    responsibilities: "",
    reason_for_leaving: "",
};

export interface ReferenceRow {
    name: string;
    title_occupation: string;
    company_name_address: string;
    contact_number: string;
}

export const EMPTY_REFERENCE: ReferenceRow = {
    name: "",
    title_occupation: "",
    company_name_address: "",
    contact_number: "",
};

export interface TrainingRow {
    title_subject: string;
    venue_location: string;
    date_from: string;
    date_to: string;
}

export const EMPTY_TRAINING: TrainingRow = {
    title_subject: "",
    venue_location: "",
    date_from: "",
    date_to: "",
};

export interface AttachmentRow {
    type: AttachmentType;
    label: string;
    // Held locally until submit, when it's uploaded and swapped for a UUID.
    // Excluded from the localStorage autosave draft (File isn't serializable).
    file: File | null;
}

export const EMPTY_ATTACHMENT: AttachmentRow = { type: "Resume", label: "", file: null };

// ============================================================================
// The form itself
// ============================================================================

export interface ApplicationFormValues {
    // Application Details
    position_applied_for: string;
    how_heard: "" | HowHeard;
    how_heard_other: string;

    // Personal Information
    first_name: string;
    middle_name: string;
    last_name: string;
    nickname: string;
    address: string;
    phone: string;
    email: string;
    birthdate: string; // "yyyy-mm-dd"
    birthplace: string;
    sex: "" | Sex;
    height_cm: string;
    weight_kg: string;
    civil_status: "" | CivilStatus;
    religion: string;
    sss_no: string;
    tin: string;
    philhealth_no: string;
    pagibig_no: string;
    drivers_license_no: string;
    photo_selected: File | null;

    // Family Background
    father: FamilyMemberFields;
    mother: FamilyMemberFields;
    spouse: FamilyMemberFields;
    family_dependents: FamilyDependentRow[];

    // Do you have relatives working at the company?
    has_company_relatives: boolean;
    company_relatives: CompanyRelativeRow[];

    // Educational Background
    education: EducationRow[];
    licensure_exams: LicensureExamRow[];

    // Skills / Other Information
    special_skills: string;
    languages: string;
    organizational_affiliations: string;
    hobbies_interests: string;

    // Work Experience
    is_fresh_graduate: boolean; // UI-only -- never submitted, just hides the list
    work_experience: WorkExperienceRow[];

    // Professional / Business References
    references: ReferenceRow[];

    // Trainings / Seminars Attended
    trainings: TrainingRow[];

    // Attachments
    attachments: AttachmentRow[];

    // Signature: draw pad by default, typed-name fallback via `signature_typed`.
    signature_typed_mode: boolean;
    signature_typed_name: string;

    // Certification
    certification_agreed: boolean;
}

export const DEFAULT_APPLICATION_FORM: ApplicationFormValues = {
    position_applied_for: "",
    how_heard: "",
    how_heard_other: "",

    first_name: "",
    middle_name: "",
    last_name: "",
    nickname: "",
    address: "",
    phone: "",
    email: "",
    birthdate: "",
    birthplace: "",
    sex: "",
    height_cm: "",
    weight_kg: "",
    civil_status: "",
    religion: "",
    sss_no: "",
    tin: "",
    philhealth_no: "",
    pagibig_no: "",
    drivers_license_no: "",
    photo_selected: null,

    father: { ...EMPTY_FAMILY_MEMBER },
    mother: { ...EMPTY_FAMILY_MEMBER },
    spouse: { ...EMPTY_FAMILY_MEMBER },
    family_dependents: [],

    has_company_relatives: false,
    company_relatives: [],

    education: [],
    licensure_exams: [],

    special_skills: "",
    languages: "",
    organizational_affiliations: "",
    hobbies_interests: "",

    is_fresh_graduate: false,
    work_experience: [],

    references: [],

    trainings: [],

    attachments: [{ ...EMPTY_ATTACHMENT }],

    signature_typed_mode: false,
    signature_typed_name: "",
    certification_agreed: false,
};

// ============================================================================
// Server-facing submit payload
// ============================================================================

export interface SubmitFamilyMember {
    relation: "Father" | "Mother" | "Spouse" | DependentRelation;
    name: string;
    age: number | null;
    occupation: string | null;
    company: string | null;
    education: string | null;
}

export interface SubmitCompanyRelative {
    name: string;
    relationship: string | null;
    position: string | null;
    area_assignment: string | null;
}

export interface SubmitEducation {
    level: EducationLevel;
    school_name: string | null;
    school_address: string | null;
    date_from: string | null;
    date_to: string | null;
    degree_units_earned: string | null;
    honors_awards: string | null;
}

export interface SubmitLicensureExam {
    examination: string;
    date_taken: string | null;
    rating: string | null;
    result: string | null;
    inclusive_dates: string | null;
}

export interface SubmitWorkExperience {
    employer: string;
    address: string | null;
    job_title: string | null;
    date_from: string | null;
    date_to: string | null;
    salary_rate_start: number | null;
    salary_rate_end: number | null;
    supervisor_name: string | null;
    supervisor_contact: string | null;
    responsibilities: string | null;
    reason_for_leaving: string | null;
}

export interface SubmitReference {
    name: string;
    title_occupation: string | null;
    company_name_address: string | null;
    contact_number: string | null;
}

export interface SubmitTraining {
    title_subject: string;
    venue_location: string | null;
    date_from: string | null;
    date_to: string | null;
}

export interface SubmitAttachment {
    type: AttachmentType;
    file: string; // uploaded Directus file UUID
    label: string | null;
}

export interface SubmitApplicationPayload {
    // Application Details
    position_applied_for: string;
    how_heard: HowHeard | null;
    how_heard_other: string | null;

    // Personal Information
    first_name: string;
    middle_name: string | null;
    last_name: string;
    nickname: string | null;
    address: string | null;
    phone: string;
    email: string | null;
    birthdate: string;
    birthplace: string | null;
    sex: Sex;
    height_cm: number | null;
    weight_kg: number | null;
    civil_status: CivilStatus | null;
    religion: string | null;
    sss_no: string | null;
    tin: string | null;
    philhealth_no: string | null;
    pagibig_no: string | null;
    drivers_license_no: string | null;
    photo_file: string | null;

    // Family Background
    family_members: SubmitFamilyMember[];
    has_company_relatives: boolean;
    company_relatives: SubmitCompanyRelative[];

    // Educational Background
    education: SubmitEducation[];
    licensure_exams: SubmitLicensureExam[];

    // Skills / Other Information
    special_skills: string | null;
    languages: string | null;
    organizational_affiliations: string | null;
    hobbies_interests: string | null;

    // Work Experience
    work_experience: SubmitWorkExperience[];

    // References
    references: SubmitReference[];

    // Trainings
    trainings: SubmitTraining[];

    // Attachments
    attachments: SubmitAttachment[];

    // Certification
    certification_agreed: true;
    certification_text_snapshot: string;
    signature_file: string | null;
}

export interface SubmitApplicationResult {
    applicant_id: number;
    application_id: number;
    warning?: string;
}

export type UploadKind = "photo" | "signature" | "attachment";
