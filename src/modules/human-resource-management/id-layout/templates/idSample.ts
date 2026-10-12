import type { IdDoc, IdVariableField } from "../types/id-layout.schema";
import { ID_CARD, ID_VARIABLES } from "../types/id-layout.schema";

export const ID_PIXEL_DATA_URL =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

export const ID_SAMPLE_USER: Readonly<Record<string, string>> = {
    user_fname: "Maria",
    user_mname: "Santos",
    user_lname: "Dela Cruz",
    suffix_name: "Jr.",
    nickname: "Ria",
    user_maiden_name: "Santos",
    full_name: "MARIA S DELA CRUZ JR.",
    user_contact: "0917-123-4567",
    user_email: "maria.delacruz@vertex.com",
    personal_email: "ria.delacruz@gmail.com",
    user_province: "Cebu",
    user_city: "Cebu City",
    user_brgy: "Lahug",
    user_bday: "January 5, 1990",
    gender: "Female",
    civil_status: "Married",
    nationality: "Filipino",
    citizenship: "Filipino",
    place_of_birth: "Cebu City",
    blood_type: "O+",
    religion: "Roman Catholic",
    spouse_name: "Jose Dela Cruz",
    emergency_contact_name: "Jose Dela Cruz",
    emergency_contact_number: "0918-765-4321",
    user_department: "Engineering",
    user_position: "Senior Developer",
    user_dateOfHire: "March 1, 2021",
    external_id: "EMP-00124",
    rf_id: "RF-88412",
    biometric_id: "BIO-55210",
    user_tin: "123-456-789-000",
    user_sss: "34-5678901-2",
    user_philhealth: "12-345678901-2",
    user_pagibig: "9876-5432-1098",
    user_image: ID_PIXEL_DATA_URL,
    signature: ID_PIXEL_DATA_URL,
    company_name: "Vertex Technologies Corporation",
    company_logo: ID_PIXEL_DATA_URL,
    is_employee: "Yes",
    is_department_head: "No",
};

export interface IdVariableGroup {
    readonly title: string;
    readonly fields: readonly IdVariableField[];
}

export const ID_VARIABLE_GROUPS: readonly IdVariableGroup[] = [
    { title: "Identity", fields: ["user_fname", "user_mname", "user_lname", "suffix_name", "nickname", "user_maiden_name", "full_name"] },
    { title: "Contact", fields: ["user_contact", "user_email", "personal_email", "user_province", "user_city", "user_brgy"] },
    { title: "Personal", fields: ["user_bday", "gender", "civil_status", "nationality", "citizenship", "place_of_birth", "blood_type", "religion", "spouse_name"] },
    { title: "Emergency", fields: ["emergency_contact_name", "emergency_contact_number"] },
    { title: "Work", fields: ["user_department", "user_position", "user_dateOfHire", "external_id", "rf_id", "biometric_id", "user_tin", "user_sss", "user_philhealth", "user_pagibig"] },
    { title: "Media", fields: ["user_image", "signature"] },
    { title: "Company", fields: ["company_name", "company_logo"] },
    { title: "Status", fields: ["is_employee", "is_department_head"] },
];

export function idVariableLabel(field: string): string {
    return field
        .split("_")
        .map((part) => (part.length > 0 ? part.charAt(0).toUpperCase() + part.slice(1) : part))
        .join(" ");
}

export function isIdVariableField(value: string): value is IdVariableField {
    return (ID_VARIABLES as readonly string[]).includes(value);
}

export function blankIdDoc(): IdDoc {
    return {
        version: 2,
        card: { width: ID_CARD.width, height: ID_CARD.height },
        pages: [
            { id: "page-front", side: "front", rootIds: [] },
            { id: "page-back", side: "back", rootIds: [] },
        ],
        nodes: {},
    };
}

export function parseIdDesignJson(raw: unknown): unknown {
    if (raw === null || raw === undefined) return null;
    if (typeof raw === "object") return raw;
    if (typeof raw !== "string" || raw.trim() === "") return null;
    try {
        return JSON.parse(raw) as unknown;
    } catch {
        return null;
    }
}
