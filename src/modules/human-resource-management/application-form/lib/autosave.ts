import type { ApplicationFormValues } from "../types";

// localStorage-only draft (architecture sec 4 item 20 -- no server-side draft
// table). One shared slot, since this is a single shared kiosk device, not a
// per-applicant identity (nobody's identified yet until submit).
//
// File objects (the selected photo, each attachment's file) can't be
// JSON-serialized and are dropped from the saved draft -- resuming a draft
// means re-picking those, everything else (including the drawn signature's
// typed-name fallback, but NOT the canvas drawing itself) comes back.

const DRAFT_KEY = "hrm_application_form_draft_v1";

export interface StoredDraft {
    savedAt: string; // ISO timestamp
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
        // Private browsing / storage disabled -- autosave is a convenience,
        // never fatal to the form.
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
        // ignore
    }
}
