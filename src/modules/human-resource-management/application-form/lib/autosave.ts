import type { ApplicationFormValues } from "../types";

const DRAFT_KEY = "hrm_application_form_draft_v1";

export interface StoredDraft {
    savedAt: string;
    values: Omit<ApplicationFormValues, "photo_selected" | "attachments"> & {
        attachments: { type: ApplicationFormValues["attachments"][number]["type"]; label: string }[];
    };
}

/**
 * True when a draft holds something worth resuming. Prevents a freshly-loaded
 * (all-default) form from being auto-saved as an "unfinished application", and
 * suppresses the resume banner for empty residue left by older sessions.
 */
export function hasDraftContent(values: {
    position_applied_for?: string;
    first_name?: string;
    last_name?: string;
    phone?: string;
    email?: string;
    birthdate?: string;
    address?: string;
    special_skills?: string;
    languages?: string;
    signature_typed_name?: string;
    sex?: string;
    civil_status?: string;
    how_heard?: string;
    education?: unknown[];
    work_experience?: unknown[];
    references?: unknown[];
    trainings?: unknown[];
    licensure_exams?: unknown[];
    company_relatives?: unknown[];
    family_dependents?: unknown[];
    has_company_relatives?: boolean;
    is_fresh_graduate?: boolean;
    certification_agreed?: boolean;
}): boolean {
    const scalars = [
        values.position_applied_for,
        values.first_name,
        values.last_name,
        values.phone,
        values.email,
        values.birthdate,
        values.address,
        values.special_skills,
        values.languages,
        values.signature_typed_name,
    ];
    if (scalars.some((v) => (v ?? "").trim() !== "")) return true;
    if (values.sex || values.civil_status || values.how_heard) return true;
    if (values.has_company_relatives || values.is_fresh_graduate || values.certification_agreed) return true;
    const arrays = [
        values.education,
        values.work_experience,
        values.references,
        values.trainings,
        values.licensure_exams,
        values.company_relatives,
        values.family_dependents,
    ];
    return arrays.some((arr) => (arr?.length ?? 0) > 0);
}

export function saveDraft(values: ApplicationFormValues): void {
    if (!hasDraftContent(values)) return;
    try {
        const { photo_selected: _photo, attachments, ...rest } = values;
        void _photo;
        const stored: StoredDraft = {
            savedAt: new Date().toISOString(),
            values: {
                ...rest,
                attachments: attachments.map((a) => ({ type: a.type, label: a.label })),
            },
        };
        window.localStorage.setItem(DRAFT_KEY, JSON.stringify(stored));
    } catch {
    }
}

export function loadDraft(): StoredDraft | null {
    try {
        const raw = window.localStorage.getItem(DRAFT_KEY);
        if (!raw) return null;
        return JSON.parse(raw) as StoredDraft;
    } catch {
        return null;
    }
}

export function clearDraft(): void {
    try {
        window.localStorage.removeItem(DRAFT_KEY);
    } catch {
    }
}
