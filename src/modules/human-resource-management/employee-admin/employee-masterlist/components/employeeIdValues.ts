import type { User } from "../types";
import { resolveEmployeeIdImageUrl } from "./employeeIdTemplate";

const EMPLOYEE_ID_DATE_KEYS = ["user_bday", "user_dateOfHire"];

const EMPLOYEE_ID_BOOLEAN_KEYS = ["is_employee", "is_department_head"];

const EMPLOYEE_ID_IMAGE_KEYS = ["user_image", "signature"];

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function firstText(row: Record<string, unknown>, keys: readonly string[]): string {
    for (const key of keys) {
        const value = row[key];
        if (typeof value === "string") {
            const trimmed = value.trim();
            if (trimmed !== "") return trimmed;
        } else if (typeof value === "number" && Number.isFinite(value)) {
            return String(value);
        }
    }
    return "";
}

export function formatEmployeeIdDate(value: unknown): string {
    if (typeof value !== "string" && typeof value !== "number") return "";
    if (typeof value === "string" && value.trim() === "") return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function employeeIdYesNo(value: unknown): string {
    if (value === true || value === 1) return "Yes";
    if (value === false || value === 0) return "No";
    if (typeof value === "string") {
        const lowered = value.trim().toLowerCase();
        if (lowered === "1" || lowered === "true" || lowered === "yes") return "Yes";
        if (lowered === "0" || lowered === "false" || lowered === "no") return "No";
    }
    return "";
}

function joinEmployeeIdFullName(fname: string, mname: string, lname: string, suffix: string): string {
    const initial = mname !== "" ? `${mname.charAt(0)}.` : "";
    return [fname, initial, lname, suffix].filter((part) => part !== "").join(" ").toUpperCase();
}

export function buildEmployeeIdValues(
    spring: User,
    row: Record<string, unknown>,
    company: Record<string, unknown> | null,
): Record<string, string> {
    const values: Record<string, string> = {};
    for (const [key, value] of Object.entries(row)) {
        if (EMPLOYEE_ID_IMAGE_KEYS.includes(key)) continue;
        if (EMPLOYEE_ID_DATE_KEYS.includes(key)) {
            const formatted = formatEmployeeIdDate(value);
            if (formatted !== "") values[key] = formatted;
            continue;
        }
        if (EMPLOYEE_ID_BOOLEAN_KEYS.includes(key)) {
            const shaped = employeeIdYesNo(value);
            if (shaped !== "") values[key] = shaped;
            continue;
        }
        if (typeof value === "string") {
            const trimmed = value.trim();
            if (trimmed !== "") values[key] = trimmed;
        } else if (typeof value === "number" && Number.isFinite(value)) {
            values[key] = String(value);
        } else if (typeof value === "boolean") {
            values[key] = value ? "Yes" : "No";
        }
    }
    if (!values.user_fname && spring.firstName) values.user_fname = spring.firstName;
    if (!values.user_mname && spring.middleName) values.user_mname = spring.middleName;
    if (!values.user_lname && spring.lastName) values.user_lname = spring.lastName;
    if (!values.suffix_name && spring.suffixName) values.suffix_name = spring.suffixName;
    if (!values.user_position && spring.position) values.user_position = spring.position;
    if (!values.user_contact && spring.contact) values.user_contact = spring.contact;
    if (!values.user_email && spring.email) values.user_email = spring.email;
    if (!values.user_city && spring.city) values.user_city = spring.city;
    if (!values.user_province && spring.province) values.user_province = spring.province;
    if (!values.external_id && spring.externalId) values.external_id = spring.externalId;
    if (!values.user_sss && spring.sssNumber) values.user_sss = spring.sssNumber;
    if (!values.user_philhealth && spring.philHealthNumber) values.user_philhealth = spring.philHealthNumber;
    if (!values.user_pagibig && spring.pagibigNumber) values.user_pagibig = spring.pagibigNumber;
    if (!values.emergency_contact_name && spring.emergencyContactName) {
        values.emergency_contact_name = spring.emergencyContactName;
    }
    if (!values.emergency_contact_number && spring.emergencyContactNumber) {
        values.emergency_contact_number = spring.emergencyContactNumber;
    }
    if (!values.user_bday && spring.birthday) {
        const formatted = formatEmployeeIdDate(spring.birthday);
        if (formatted !== "") values.user_bday = formatted;
    }
    if (!values.user_dateOfHire && spring.dateOfHire) {
        const formatted = formatEmployeeIdDate(spring.dateOfHire);
        if (formatted !== "") values.user_dateOfHire = formatted;
    }
    if (!values.full_name) {
        const derived = joinEmployeeIdFullName(
            values.user_fname ?? "",
            values.user_mname ?? "",
            values.user_lname ?? "",
            values.suffix_name ?? "",
        );
        if (derived !== "") values.full_name = derived;
    }
    const photo = firstText(row, ["user_image"]) || spring.image || "";
    const resolvedPhoto = resolveEmployeeIdImageUrl(photo === "" ? null : photo);
    if (resolvedPhoto !== "") values.user_image = resolvedPhoto;
    const signature = firstText(row, ["signature"]) || spring.signature || "";
    const resolvedSignature = resolveEmployeeIdImageUrl(signature === "" ? null : signature);
    if (resolvedSignature !== "") values.signature = resolvedSignature;
    if (company && isRecord(company)) {
        const companyName = firstText(company, ["company_name"]);
        if (companyName !== "") values.company_name = companyName;
        const companyLogo = firstText(company, ["company_logo"]);
        const resolvedLogo = resolveEmployeeIdImageUrl(companyLogo === "" ? null : companyLogo);
        if (resolvedLogo !== "") values.company_logo = resolvedLogo;
    }
    return values;
}
