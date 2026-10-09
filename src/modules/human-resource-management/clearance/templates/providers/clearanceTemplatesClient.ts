import { z } from "zod";

import {
    ClearanceCategorySchema,
    ClearanceCategorySignatorySchema,
    ClearanceTemplateSchema,
    type ClearanceCategory,
    type ClearanceCategorySignatory,
    type ClearanceSignerType,
    type ClearanceTemplate,
} from "../types";

export const CLEARANCE_TEMPLATES_API_BASE = "/api/hrm/clearance/templates";

export interface TemplateCreateInput {
    code: string;
    title: string;
    description: string | null;
    department_id: number | null;
}

export interface TemplateUpdateInput {
    title?: string;
    description?: string | null;
    department_id?: number | null;
    is_active?: boolean;
}

export interface CategoryCreateInput {
    label: string;
    instructions: string | null;
    signer_type: ClearanceSignerType;
    department_id: number | null;
}

export interface CategoryUpdateInput {
    label?: string;
    instructions?: string | null;
    signer_type?: ClearanceSignerType;
    department_id?: number | null;
    is_active?: boolean;
}

export interface ClearanceReorderEntry {
    id: number;
    sort_order: number;
}

const SuccessListEnvelopeSchema = z.object({
    success: z.literal(true),
    data: z.array(z.unknown()),
});

const SuccessItemEnvelopeSchema = z.object({
    success: z.literal(true),
    data: z.unknown(),
});

const FailureEnvelopeSchema = z.object({
    success: z.literal(false),
    message: z.string(),
});

async function readBody(res: Response): Promise<unknown> {
    return res.json().catch(() => null);
}

function failureMessage(body: unknown, fallback: string): string {
    const parsed = FailureEnvelopeSchema.safeParse(body);
    if (parsed.success && parsed.data.message.trim() !== "") {
        return parsed.data.message;
    }
    return fallback;
}

function parseRow<T>(schema: z.ZodType<T>, row: unknown): T {
    const parsed = schema.safeParse(row);
    if (!parsed.success) {
        throw new Error("The server returned data in an unexpected shape.");
    }
    return parsed.data;
}

async function requestList<T>(url: string, schema: z.ZodType<T>, init?: RequestInit): Promise<T[]> {
    const res = await fetch(url, { cache: "no-store", ...init });
    const body: unknown = await readBody(res);
    if (!res.ok) {
        throw new Error(failureMessage(body, "Request failed"));
    }
    const envelope = SuccessListEnvelopeSchema.safeParse(body);
    if (!envelope.success) {
        throw new Error(failureMessage(body, "Request failed"));
    }
    return envelope.data.data.map((row) => parseRow(schema, row));
}

async function requestItem<T>(url: string, schema: z.ZodType<T>, init: RequestInit): Promise<T> {
    const res = await fetch(url, { cache: "no-store", ...init });
    const body: unknown = await readBody(res);
    if (!res.ok) {
        throw new Error(failureMessage(body, "Request failed"));
    }
    const envelope = SuccessItemEnvelopeSchema.safeParse(body);
    if (!envelope.success) {
        throw new Error(failureMessage(body, "Request failed"));
    }
    return parseRow(schema, envelope.data.data);
}

function jsonInit(method: string, payload: unknown): RequestInit {
    return {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    };
}

function templateQuery(all: boolean): string {
    return all ? `${CLEARANCE_TEMPLATES_API_BASE}?all=1` : CLEARANCE_TEMPLATES_API_BASE;
}

function categoryBase(templateId: number): string {
    return `${CLEARANCE_TEMPLATES_API_BASE}/${templateId}/categories`;
}

function categoryQuery(templateId: number, all: boolean): string {
    return all ? `${categoryBase(templateId)}?all=1` : categoryBase(templateId);
}

function categoryPath(templateId: number, categoryId: number): string {
    return `${categoryBase(templateId)}/${categoryId}`;
}

function signatoriesPath(templateId: number, categoryId: number): string {
    return `${categoryPath(templateId, categoryId)}/signatories`;
}

export function listTemplates(all: boolean): Promise<ClearanceTemplate[]> {
    return requestList(templateQuery(all), ClearanceTemplateSchema);
}

export function createTemplate(input: TemplateCreateInput): Promise<ClearanceTemplate> {
    return requestItem(CLEARANCE_TEMPLATES_API_BASE, ClearanceTemplateSchema, jsonInit("POST", input));
}

export function updateTemplate(id: number, input: TemplateUpdateInput): Promise<ClearanceTemplate> {
    return requestItem(
        `${CLEARANCE_TEMPLATES_API_BASE}/${id}`,
        ClearanceTemplateSchema,
        jsonInit("PATCH", input)
    );
}

export function deactivateTemplate(id: number): Promise<ClearanceTemplate> {
    return requestItem(
        `${CLEARANCE_TEMPLATES_API_BASE}/${id}`,
        ClearanceTemplateSchema,
        { method: "DELETE" }
    );
}

export function listCategories(templateId: number, all: boolean): Promise<ClearanceCategory[]> {
    return requestList(categoryQuery(templateId, all), ClearanceCategorySchema);
}

export function createCategory(templateId: number, input: CategoryCreateInput): Promise<ClearanceCategory> {
    return requestItem(categoryBase(templateId), ClearanceCategorySchema, jsonInit("POST", input));
}

export function updateCategory(
    templateId: number,
    categoryId: number,
    input: CategoryUpdateInput
): Promise<ClearanceCategory> {
    return requestItem(categoryPath(templateId, categoryId), ClearanceCategorySchema, jsonInit("PATCH", input));
}

export function deactivateCategory(templateId: number, categoryId: number): Promise<ClearanceCategory> {
    return requestItem(categoryPath(templateId, categoryId), ClearanceCategorySchema, { method: "DELETE" });
}

export function reorderCategories(
    templateId: number,
    order: readonly ClearanceReorderEntry[]
): Promise<ClearanceCategory[]> {
    return requestList(
        `${categoryBase(templateId)}/reorder`,
        ClearanceCategorySchema,
        jsonInit("PATCH", { order })
    );
}

export function listCategorySignatories(
    templateId: number,
    categoryId: number
): Promise<ClearanceCategorySignatory[]> {
    return requestList(signatoriesPath(templateId, categoryId), ClearanceCategorySignatorySchema);
}

export function replaceCategorySignatories(
    templateId: number,
    categoryId: number,
    userIds: number[]
): Promise<ClearanceCategorySignatory[]> {
    return requestList(
        signatoriesPath(templateId, categoryId),
        ClearanceCategorySignatorySchema,
        jsonInit("PUT", { user_ids: userIds })
    );
}
