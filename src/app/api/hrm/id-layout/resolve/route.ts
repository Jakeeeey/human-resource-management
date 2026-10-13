import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ID_TEMPLATES_COLLECTION = "id_templates";
const ID_TEMPLATE_RESOLVE_FIELDS = "id,name,company_id,is_default,design_json,is_active";
const COMPANY_RESOLVE_FIELDS = "company_id,company_name,company_code,company_logo";

const ID_USER_VARIABLE_KEYS = [
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
    "user_bday",
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
    "user_dateOfHire",
    "external_id",
    "rf_id",
    "biometric_id",
    "user_tin",
    "user_sss",
    "user_philhealth",
    "user_pagibig",
    "user_image",
    "signature",
    "is_employee",
    "is_department_head",
];

const DIRECTUS_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
const STATIC_TOKEN = process.env.DIRECTUS_STATIC_TOKEN;

async function dFetch(path: string, options?: RequestInit): Promise<unknown> {
    const res = await fetch(`${DIRECTUS_URL}${path}`, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${STATIC_TOKEN}`,
            ...(options?.headers || {}),
        },
    });
    if (!res.ok) {
        const text = await res.text();
        try {
            return JSON.parse(text);
        } catch {
            throw new Error(text);
        }
    }
    if (res.status === 204) {
        return null;
    }
    return res.json();
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

function directusMessage(value: unknown): string | null {
    if (!isRecord(value)) {
        return null;
    }
    const errors = value.errors;
    if (Array.isArray(errors) && errors.length > 0) {
        const first = errors[0];
        if (isRecord(first) && typeof first.message === "string") {
            return first.message;
        }
    }
    if (typeof value.message === "string") {
        return value.message;
    }
    return null;
}

function parseDesignJson(value: unknown): unknown {
    if (typeof value !== "string") {
        return value;
    }
    try {
        return JSON.parse(value);
    } catch {
        return value;
    }
}

function readRows(body: unknown): Array<Record<string, unknown>> | null {
    if (!isRecord(body) || !Array.isArray(body.data)) {
        return null;
    }
    return body.data.filter(isRecord);
}

function toResolveTemplate(row: Record<string, unknown>): Record<string, unknown> {
    const companyId = row.company_id;
    return {
        id: row.id,
        name: row.name,
        company_id: typeof companyId === "number" && Number.isInteger(companyId) ? companyId : null,
        is_default:
            row.is_default === true ||
            row.is_default === 1 ||
            row.is_default === "1" ||
            row.is_default === "true",
        design_json: parseDesignJson(row.design_json),
    };
}

function toResolveUser(row: Record<string, unknown>): Record<string, unknown> {
    const user: Record<string, unknown> = {
        user_id: row.user_id ?? null,
        company_id: row.company_id ?? null,
    };
    for (const key of ID_USER_VARIABLE_KEYS) {
        user[key] = row[key] ?? null;
    }
    return user;
}

function toResolveCompany(row: Record<string, unknown>): Record<string, unknown> {
    return {
        company_id: row.company_id ?? null,
        company_name: row.company_name ?? null,
        company_code: row.company_code ?? null,
        company_logo: row.company_logo ?? null,
    };
}

function companyIdOf(row: Record<string, unknown>): number | null {
    const value = row.company_id;
    if (typeof value === "number" && Number.isInteger(value) && value > 0) {
        return value;
    }
    if (typeof value === "string" && /^\d+$/.test(value.trim())) {
        const parsed = Number(value.trim());
        if (Number.isInteger(parsed) && parsed > 0) {
            return parsed;
        }
    }
    return null;
}

export async function GET(req: NextRequest) {
    try {
        const rawUserId = req.nextUrl.searchParams.get("user_id");
        const userId = rawUserId === null ? NaN : Number(rawUserId);
        if (!Number.isInteger(userId) || userId < 1) {
            return NextResponse.json({ message: "Invalid user_id" }, { status: 400 });
        }
        if (!DIRECTUS_URL) {
            return NextResponse.json(
                { message: "ID layout service is unavailable" },
                { status: 500 }
            );
        }
        const userBody: unknown = await dFetch(
            `/items/user?filter[user_id][_eq]=${encodeURIComponent(String(userId))}&fields=*&limit=1`
        );
        const userRows = readRows(userBody);
        if (userRows === null) {
            console.error("[id-layout-resolve] user read error:", directusMessage(userBody));
            return NextResponse.json(
                { message: "ID layout service is unavailable" },
                { status: 500 }
            );
        }
        if (userRows.length === 0) {
            return NextResponse.json({ message: "Employee record was not found" }, { status: 404 });
        }
        const userRow = userRows[0];
        const companyId = companyIdOf(userRow);
        let company: Record<string, unknown> | null = null;
        if (companyId !== null) {
            const companyBody: unknown = await dFetch(
                `/items/company_list?filter[company_id][_eq]=${companyId}&fields=${COMPANY_RESOLVE_FIELDS}&limit=1`
            );
            const companyRows = readRows(companyBody);
            if (companyRows === null) {
                console.error("[id-layout-resolve] company read error:", directusMessage(companyBody));
                return NextResponse.json(
                    { message: "ID layout service is unavailable" },
                    { status: 500 }
                );
            }
            company = companyRows.length > 0 ? toResolveCompany(companyRows[0]) : null;
        }
        let template: Record<string, unknown> | null = null;
        if (companyId !== null) {
            const matchBody: unknown = await dFetch(
                `/items/${ID_TEMPLATES_COLLECTION}?filter[company_id][_eq]=${companyId}&filter[is_active][_eq]=1&fields=${ID_TEMPLATE_RESOLVE_FIELDS}&limit=1`
            );
            const matchRows = readRows(matchBody);
            if (matchRows === null) {
                console.error("[id-layout-resolve] template match error:", directusMessage(matchBody));
                return NextResponse.json(
                    { message: "ID layout service is unavailable" },
                    { status: 500 }
                );
            }
            template = matchRows.length > 0 ? toResolveTemplate(matchRows[0]) : null;
        }
        if (template === null) {
            const defaultBody: unknown = await dFetch(
                `/items/${ID_TEMPLATES_COLLECTION}?filter[is_default][_eq]=1&filter[is_active][_eq]=1&sort=id&fields=${ID_TEMPLATE_RESOLVE_FIELDS}&limit=1`
            );
            const defaultRows = readRows(defaultBody);
            if (defaultRows === null) {
                console.error(
                    "[id-layout-resolve] default template error:",
                    directusMessage(defaultBody)
                );
                return NextResponse.json(
                    { message: "ID layout service is unavailable" },
                    { status: 500 }
                );
            }
            template = defaultRows.length > 0 ? toResolveTemplate(defaultRows[0]) : null;
        }
        return NextResponse.json({ template, user: toResolveUser(userRow), company });
    } catch (error) {
        console.error("[id-layout-resolve] GET error:", error);
        return NextResponse.json(
            { message: "ID layout service is unavailable" },
            { status: 500 }
        );
    }
}
