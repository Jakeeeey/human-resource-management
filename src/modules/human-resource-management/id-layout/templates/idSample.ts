import type { IdDoc, IdVariableField } from "../types/id-layout.schema";
import { ID_CARD, ID_VARIABLES } from "../types/id-layout.schema";

export const ID_PIXEL_DATA_URL =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

export const ID_SAMPLE_USER: Readonly<Record<string, string>> = {
    full_name: "MARIA S DELA CRUZ JR.",
    user_id: "24",
    user_contact: "0917-123-4567",
    user_email: "maria.delacruz@vertex.com",
    full_address: "Lahug, Cebu City, Cebu",
    user_bday: "January 5, 1990",
    emergency_contact_name: "Jose Dela Cruz",
    emergency_contact_number: "0918-765-4321",
    user_department: "Engineering",
    user_position: "Senior Developer",
    user_dateOfHire: "March 1, 2021",
    external_id: "EMP-00124",
    user_tin: "123-456-789-000",
    user_sss: "34-5678901-2",
    user_philhealth: "12-345678901-2",
    user_pagibig: "9876-5432-1098",
    company_name: "Vertex Technologies Corporation",
};

export interface IdVariableGroup {
    readonly title: string;
    readonly fields: readonly IdVariableField[];
}

export const ID_VARIABLE_GROUPS: readonly IdVariableGroup[] = [
    { title: "Identity", fields: ["full_name", "user_id"] },
    { title: "Contact", fields: ["user_contact", "user_email", "full_address"] },
    { title: "Personal", fields: ["user_bday"] },
    { title: "Emergency", fields: ["emergency_contact_name", "emergency_contact_number"] },
    { title: "Work", fields: ["user_department", "user_position", "user_dateOfHire", "external_id", "user_tin", "user_sss", "user_philhealth", "user_pagibig"] },
    { title: "Company", fields: ["company_name"] },
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
