const ID_VIEWER_UUID_PATTERN =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ID_VIEWER_MONTHS = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
];

const ID_VIEWER_PASSTHROUGH_FIELDS = [
    "user_fname",
    "user_mname",
    "user_lname",
    "suffix_name",
    "nickname",
    "user_maiden_name",
    "user_contact",
    "user_email",
    "personal_email",
    "user_province",
    "user_city",
    "user_brgy",
    "gender",
    "civil_status",
    "nationality",
    "citizenship",
    "place_of_birth",
    "blood_type",
    "religion",
    "spouse_name",
    "emergency_contact_name",
    "emergency_contact_number",
    "user_department",
    "user_position",
    "external_id",
    "rf_id",
    "biometric_id",
    "user_tin",
    "user_sss",
    "user_philhealth",
    "user_pagibig",
];

export interface IdViewerCompanyInput {
    readonly company_name?: unknown;
    readonly company_logo?: unknown;
}

export function resolveIdViewerImageUrl(path: unknown): string {
    if (typeof path !== "string") return "";
    const clean = path.trim();
    if (clean === "") return "";
    if (clean.startsWith("http") || clean.startsWith("blob:") || clean.startsWith("data:")) {
        return clean;
    }
    if (ID_VIEWER_UUID_PATTERN.test(clean)) {
        return `/api/hrm/employee-admin/employee-master-list/assets/${clean}`;
    }
    return clean;
}

function viewerScalarOf(value: unknown): string {
    if (typeof value === "string") return value;
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
    if (typeof value === "object" && value !== null) {
        const record = value as Readonly<Record<string, unknown>>;
        const named = record.department_name ?? record.name;
        if (typeof named === "string" && named.trim() !== "") return named;
    }
    return "";
}

function formatIdViewerDate(value: unknown): string {
    if (typeof value !== "string" || value.trim() === "") return "";
    const time = Date.parse(value.trim());
    if (Number.isNaN(time)) return "";
    const date = new Date(time);
    return `${ID_VIEWER_MONTHS[date.getUTCMonth()]} ${date.getUTCDate()}, ${date.getUTCFullYear()}`;
}

function formatIdViewerBoolean(value: unknown): string {
    if (value === true || value === 1 || value === "1" || value === "true") return "Yes";
    if (value === false || value === 0 || value === "0" || value === "false") return "No";
    return "";
}

function fullIdViewerNameOf(user: Readonly<Record<string, unknown>>): string {
    const fname = viewerScalarOf(user.user_fname).trim();
    const mname = viewerScalarOf(user.user_mname).trim();
    const lname = viewerScalarOf(user.user_lname).trim();
    const suffix = viewerScalarOf(user.suffix_name).trim();
    const parts: string[] = [];
    if (fname !== "") parts.push(fname);
    if (mname !== "") parts.push(`${mname.charAt(0)}.`);
    if (lname !== "") parts.push(lname);
    if (suffix !== "") parts.push(suffix);
    const full = parts.join(" ");
    return full === "" ? "" : full.toUpperCase();
}

export function buildIdViewerValues(
    user: Readonly<Record<string, unknown>>,
    company: IdViewerCompanyInput | null,
): Record<string, string> {
    const values: Record<string, string> = {};
    for (const key of ID_VIEWER_PASSTHROUGH_FIELDS) {
        values[key] = viewerScalarOf(user[key]);
    }
    values.user_bday = formatIdViewerDate(user.user_bday);
    values.user_dateOfHire = formatIdViewerDate(user.user_dateOfHire);
    values.is_employee = formatIdViewerBoolean(user.is_employee);
    values.is_department_head = formatIdViewerBoolean(user.is_department_head);
    values.full_name = fullIdViewerNameOf(user);
    values.company_name =
        company !== null && typeof company.company_name === "string" ? company.company_name : "";
    values.user_image = resolveIdViewerImageUrl(user.user_image);
    values.signature = resolveIdViewerImageUrl(user.signature);
    values.company_logo = resolveIdViewerImageUrl(company?.company_logo);
    return values;
}
