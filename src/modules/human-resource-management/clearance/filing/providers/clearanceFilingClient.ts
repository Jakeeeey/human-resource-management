import { z } from "zod";

import type { ClearanceItemStatus, ClearanceRequestStatus, ClearanceSignerType } from "../types";
import {
    CLEARANCE_ITEM_STATUSES,
    CLEARANCE_REQUEST_STATUSES,
    CLEARANCE_SIGNER_TYPES,
} from "../types";

export class ClearanceFilingClientError extends Error {
    readonly status: number;
    readonly code: string | undefined;

    constructor(status: number, message: string, code?: string) {
        super(message);
        this.name = "ClearanceFilingClientError";
        this.status = status;
        this.code = code;
    }
}

export interface OwnRequestSummary {
    id: number;
    resignation_id: number;
    template_title_snapshot: string | null;
    status: ClearanceRequestStatus;
    created_at: string | null;
    confirmed_at: string | null;
}

export interface FilingItem {
    id: number;
    request_id: number;
    label_snapshot: string;
    instructions_snapshot: string | null;
    signer_type_snapshot: ClearanceSignerType;
    department_name_snapshot: string | null;
    sort_order: number;
    status: ClearanceItemStatus;
    expected_signer_user_id: number | null;
    signed_by_user_id: number | null;
    substitution_reason: string | null;
    remarks: string | null;
    signed_at: string | null;
}

export interface FilingDetail {
    id: number;
    resignation_id: number;
    user_id: number;
    template_title_snapshot: string | null;
    template_code_snapshot: string | null;
    status: ClearanceRequestStatus;
    created_at: string | null;
    confirmed_at: string | null;
    items: FilingItem[];
    signed_count: number;
    total_count: number;
    cleared: boolean;
}

export interface FilingCandidate {
    user_id: number;
    full_name: string;
    is_department_head: boolean;
    department_name: string | null;
}

export interface PrintableItem {
    id: number;
    label_snapshot: string;
    instructions_snapshot: string | null;
    status: string;
    expected_signer_user_id: number | null;
    expected_signer_name: string | null;
    signed_by_user_id: number | null;
    signer_name: string | null;
    signed_at: string | null;
    signature_strokes: string | null;
    substitution_reason: string | null;
    remarks: string | null;
}

export interface ClearancePrintable {
    id: number;
    resignation_id: number;
    user_id: number;
    employee_name: string;
    template_title_snapshot: string | null;
    status: string;
    created_at: string | null;
    confirmed_at: string | null;
    items: PrintableItem[];
}

export interface SignItemInput {
    signatureStrokes: string;
    signedByUserId: number;
    substitutionReason: string | null;
    remarks: string | null;
}

const FILING_BASE = "/api/hrm/clearance";

const FailureEnvelopeSchema = z.object({
    success: z.literal(false),
    message: z.string(),
    code: z.string().optional(),
});

const CandidateSchema = z.object({
    user_id: z.number(),
    full_name: z.string(),
    is_department_head: z.boolean(),
    department_name: z.string().nullable().optional().transform((value) => value ?? null),
});

const FilingItemSchema: z.ZodType<FilingItem> = z.object({
    id: z.number(),
    request_id: z.number(),
    label_snapshot: z.string(),
    instructions_snapshot: z.string().nullable(),
    signer_type_snapshot: z.enum(CLEARANCE_SIGNER_TYPES),
    department_name_snapshot: z.string().nullable(),
    sort_order: z.number(),
    status: z.enum(CLEARANCE_ITEM_STATUSES),
    expected_signer_user_id: z.number().nullable(),
    signed_by_user_id: z.number().nullable(),
    substitution_reason: z.string().nullable(),
    remarks: z.string().nullable(),
    signed_at: z.string().nullable(),
}).passthrough() as unknown as z.ZodType<FilingItem>;

const FilingDetailSchema: z.ZodType<FilingDetail> = z.object({
    id: z.number(),
    resignation_id: z.number(),
    user_id: z.number(),
    template_title_snapshot: z.string().nullable(),
    template_code_snapshot: z.string().nullable(),
    status: z.enum(CLEARANCE_REQUEST_STATUSES),
    created_at: z.string().nullable(),
    confirmed_at: z.string().nullable(),
    items: z.array(FilingItemSchema),
    signed_count: z.number(),
    total_count: z.number(),
    cleared: z.boolean(),
}).passthrough() as unknown as z.ZodType<FilingDetail>;

const PrintableItemSchema: z.ZodType<PrintableItem> = z.object({
    id: z.number(),
    label_snapshot: z.string(),
    instructions_snapshot: z.string().nullable(),
    status: z.string(),
    expected_signer_user_id: z.number().nullable(),
    expected_signer_name: z.string().nullable(),
    signed_by_user_id: z.number().nullable(),
    signer_name: z.string().nullable(),
    signed_at: z.string().nullable(),
    signature_strokes: z.string().nullable(),
    substitution_reason: z.string().nullable(),
    remarks: z.string().nullable(),
}).passthrough() as unknown as z.ZodType<PrintableItem>;

const PrintableSchema: z.ZodType<ClearancePrintable> = z.object({
    id: z.number(),
    resignation_id: z.number(),
    user_id: z.number(),
    employee_name: z.string(),
    template_title_snapshot: z.string().nullable(),
    status: z.string(),
    created_at: z.string().nullable(),
    confirmed_at: z.string().nullable(),
    items: z.array(PrintableItemSchema),
}).passthrough() as unknown as z.ZodType<ClearancePrintable>;

function friendlyMessage(code: string | undefined, serverMessage: string, fallback: string): string {
    switch (code) {
        case "NO_PICK":
            return "Choose a signer for this category first.";
        case "SUBSTITUTION_REASON_REQUIRED":
            return "A different person signed, so a short explanation is required before saving.";
        case "SUBJECT_SELF_SIGN":
            return "You cannot sign your own clearance. Choose someone else.";
        case "SIGNER_NOT_IN_SET":
            return "That person cannot sign this category. Choose someone else from the list.";
        case "ITEM_SIGNED":
            return "This category is already signed and cannot be changed. Contact HR if a correction is needed.";
        case "REQUEST_COMPLETED":
            return "This clearance is already completed and locked. Contact HR if a correction is needed.";
        default:
            return serverMessage.trim() !== "" ? serverMessage : fallback;
    }
}

function toClientError(status: number, body: unknown, fallback: string): ClearanceFilingClientError {
    const parsed = FailureEnvelopeSchema.safeParse(body);
    if (parsed.success) {
        return new ClearanceFilingClientError(
            status,
            friendlyMessage(parsed.data.code, parsed.data.message, fallback),
            parsed.data.code
        );
    }
    return new ClearanceFilingClientError(status, fallback);
}

async function requestData(path: string, init?: RequestInit, fallback?: string): Promise<unknown> {
    const res = await fetch(path, { cache: "no-store", ...init });
    const body: unknown = await res.json().catch(() => null);
    if (!res.ok) {
        throw toClientError(res.status, body, fallback ?? "The request failed. Please try again.");
    }
    if (typeof body !== "object" || body === null || (body as { success?: unknown }).success !== true) {
        throw toClientError(res.status, body, fallback ?? "The request failed. Please try again.");
    }
    return (body as { data: unknown }).data;
}

function parseOrThrow<T>(schema: z.ZodType<T>, data: unknown, fallback: string): T {
    const parsed = schema.safeParse(data);
    if (!parsed.success) {
        throw new ClearanceFilingClientError(500, fallback);
    }
    return parsed.data;
}

function jsonInit(method: string, payload: unknown): RequestInit {
    return {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    };
}

export async function getFilingDetail(requestId: number): Promise<FilingDetail> {
    const data = await requestData(
        `${FILING_BASE}/requests/${requestId}`,
        undefined,
        "Could not load your clearance. Please try again."
    );
    return parseOrThrow(FilingDetailSchema, data, "The server returned your clearance in an unexpected shape.");
}

export async function getFilingCandidates(itemId: number): Promise<FilingCandidate[]> {
    const data = await requestData(
        `${FILING_BASE}/signatories?item_id=${itemId}`,
        undefined,
        "Could not load the signer list. Please try again."
    );
    return parseOrThrow(
        z.array(CandidateSchema),
        data,
        "The server returned the signer list in an unexpected shape."
    );
}

export async function pickFilingSigner(itemId: number, userId: number): Promise<FilingItem> {
    const data = await requestData(
        `${FILING_BASE}/items/${itemId}/pick`,
        jsonInit("POST", { user_id: userId }),
        "Could not save your chosen signer. Please try again."
    );
    return parseOrThrow(FilingItemSchema, data, "The server returned the updated category in an unexpected shape.");
}

export async function signFilingItem(itemId: number, input: SignItemInput): Promise<FilingItem> {
    const data = await requestData(
        `${FILING_BASE}/items/${itemId}/sign`,
        jsonInit("POST", {
            signature_strokes: input.signatureStrokes,
            signed_by_user_id: input.signedByUserId,
            substitution_reason: input.substitutionReason,
            remarks: input.remarks,
        }),
        "Could not save the signature. Please try again."
    );
    return parseOrThrow(FilingItemSchema, data, "The server returned the signed category in an unexpected shape.");
}

export async function getFilingPrintable(requestId: number): Promise<ClearancePrintable> {
    const data = await requestData(
        `${FILING_BASE}/requests/${requestId}/printable`,
        undefined,
        "Could not load the printable clearance. Please try again."
    );
    return parseOrThrow(PrintableSchema, data, "The server returned the printable clearance in an unexpected shape.");
}
