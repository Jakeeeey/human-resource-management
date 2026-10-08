import { z } from "zod";

import {
    SoaTemplateRowSchema,
    SoaTemplateSchema,
    type SoaTemplate,
    type SoaTemplateRow,
} from "../types";

export const SOA_TEMPLATES_API_BASE = "/api/hrm/clearance/soa-templates";

export interface SoaTemplateCreateInput {
    code: string;
    title: string;
    description: string | null;
    department_id: number | null;
}

export interface SoaTemplateUpdateInput {
    title?: string;
    description?: string | null;
    department_id?: number | null;
    is_active?: boolean;
}

export interface SoaRowCreateInput {
    label: string;
}

export interface SoaRowUpdateInput {
    label?: string;
    is_active?: boolean;
}

export interface SoaReorderEntry {
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
    return all ? `${SOA_TEMPLATES_API_BASE}?all=1` : SOA_TEMPLATES_API_BASE;
}

function rowBase(templateId: number): string {
    return `${SOA_TEMPLATES_API_BASE}/${templateId}/rows`;
}

function rowQuery(templateId: number, all: boolean): string {
    return all ? `${rowBase(templateId)}?all=1` : rowBase(templateId);
}

function rowPath(templateId: number, rowId: number): string {
    return `${rowBase(templateId)}/${rowId}`;
}

export function listSoaTemplates(all: boolean): Promise<SoaTemplate[]> {
    return requestList(templateQuery(all), SoaTemplateSchema);
}

export function createSoaTemplate(input: SoaTemplateCreateInput): Promise<SoaTemplate> {
    return requestItem(SOA_TEMPLATES_API_BASE, SoaTemplateSchema, jsonInit("POST", input));
}

export function updateSoaTemplate(id: number, input: SoaTemplateUpdateInput): Promise<SoaTemplate> {
    return requestItem(
        `${SOA_TEMPLATES_API_BASE}/${id}`,
        SoaTemplateSchema,
        jsonInit("PATCH", input)
    );
}

export function deactivateSoaTemplate(id: number): Promise<SoaTemplate> {
    return requestItem(
        `${SOA_TEMPLATES_API_BASE}/${id}`,
        SoaTemplateSchema,
        { method: "DELETE" }
    );
}

export function listSoaRows(templateId: number, all: boolean): Promise<SoaTemplateRow[]> {
    return requestList(rowQuery(templateId, all), SoaTemplateRowSchema);
}

export function createSoaRow(templateId: number, input: SoaRowCreateInput): Promise<SoaTemplateRow> {
    return requestItem(rowBase(templateId), SoaTemplateRowSchema, jsonInit("POST", input));
}

export function updateSoaRow(
    templateId: number,
    rowId: number,
    input: SoaRowUpdateInput
): Promise<SoaTemplateRow> {
    return requestItem(rowPath(templateId, rowId), SoaTemplateRowSchema, jsonInit("PATCH", input));
}

export function deactivateSoaRow(templateId: number, rowId: number): Promise<SoaTemplateRow> {
    return requestItem(rowPath(templateId, rowId), SoaTemplateRowSchema, { method: "DELETE" });
}

export function reorderSoaRows(
    templateId: number,
    order: readonly SoaReorderEntry[]
): Promise<SoaTemplateRow[]> {
    return requestList(
        `${rowBase(templateId)}/reorder`,
        SoaTemplateRowSchema,
        jsonInit("PATCH", { order })
    );
}
