import type { ApplicationFormValues } from "../types";

const DRAFT_KEY = "hrm_application_form_draft_v1";

export interface StoredDraft {
    savedAt: string;
    values: Omit<ApplicationFormValues, "photo_selected" | "attachments"> & {
        attachments: { type: ApplicationFormValues["attachments"][number]["type"]; label: string }[];
    };
}

export function saveDraft(values: ApplicationFormValues): void {
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
