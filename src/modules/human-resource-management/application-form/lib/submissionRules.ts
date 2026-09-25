import { contactError, contactNumberError, govIdError, phoneError, type GovIdKind } from "./hardValidation";

export interface SubmissionToCheck {
    phone: string;
    sss_no: string | null;
    tin: string | null;
    philhealth_no: string | null;
    pagibig_no: string | null;
    family_members?: { relation: string; name: string; contact_number?: string | null }[];
    work_experience?: { employer: string; supervisor_contact?: string | null }[];
}

const GOV_ID_FIELDS: [keyof SubmissionToCheck, GovIdKind][] = [
    ["sss_no", "sss"],
    ["tin", "tin"],
    ["philhealth_no", "philhealth"],
    ["pagibig_no", "pagibig"],
];

export function submissionError(body: SubmissionToCheck): string | null {
    const phone = phoneError(body.phone ?? "");
    if (phone) return `Contact number: ${phone}`;

    for (const [field, kind] of GOV_ID_FIELDS) {
        const err = govIdError(kind, String(body[field] ?? ""));
        if (err) return err;
    }

    for (const m of body.family_members ?? []) {
        const err = contactNumberError(m.contact_number ?? "");
        if (err) return `${m.relation}${m.name ? ` (${m.name})` : ""}: ${err}`;
    }

    for (const w of body.work_experience ?? []) {
        const err = contactError(w.supervisor_contact ?? "");
        if (err) return `Work experience (${w.employer}): ${err}`;
    }
    return null;
}
