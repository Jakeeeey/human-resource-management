"use client";

import { useCallback, useEffect, useState } from "react";

import type { SoaSignatory, SoaStatus } from "../types";
import { SoaSignatoriesSchema } from "../types";
import type { SoaPrintInput } from "../utils/soaPrintPdf";

export interface SoaDetailLine {
    id: number;
    soa_id: number;
    item_id: number | null;
    soa_template_row_id: number | null;
    description: string | null;
    amount: number | null;
    remarks: string | null;
    sort_order: number;
}

export interface SoaRowGroup {
    id: number;
    label: string;
    sort_order: number;
}

export interface SoaDetail {
    id: number;
    request_id: number;
    status: SoaStatus;
    ref_no: string | null;
    clearance_no: string | null;
    company_code: string | null;
    signatories: SoaSignatory[] | null;
    pdf_file: string | null;
    approved_at: string | null;
    lines: SoaDetailLine[];
    groups: SoaRowGroup[];
}

export interface SoaRequestItem {
    id: number;
    label_snapshot: string;
    sort_order: number;
}

export interface SoaLinePayload {
    item_id: number | null;
    soa_template_row_id: number | null;
    description: string;
    amount: number | null;
    remarks: string;
    sort_order: number;
}

export interface SoaCompanyPayload {
    company_name: string;
    company_address: string;
    logo_data_url: string | null;
}

const BY_REQUEST_API = "/api/hrm/clearance/soa/by-request";
const RENDER_MODEL_API = "/api/hrm/clearance/soa/render-model";
const APPROVE_API = "/api/hrm/clearance/soa/approve";

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

function toId(value: unknown): number | null {
    if (typeof value === "number" && Number.isInteger(value)) return value;
    if (typeof value === "string" && value.trim() !== "") {
        const parsed = Number(value);
        return Number.isInteger(parsed) ? parsed : null;
    }
    return null;
}

function toNullableText(value: unknown): string | null {
    if (value === null || value === undefined) return null;
    return typeof value === "string" ? value : null;
}

function toNullableAmount(value: unknown): number | null {
    if (value === null || value === undefined || value === "") return null;
    const parsed = typeof value === "number" ? value : Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

function toStatus(value: unknown): SoaStatus | null {
    return value === "pending" || value === "approved" ? value : null;
}

function normalizeLine(raw: unknown): SoaDetailLine | null {
    if (!isRecord(raw)) return null;
    const id = toId(raw.id);
    const soaId = toId(raw.soa_id);
    const itemId = toId(raw.item_id);
    const templateRowId = toId(raw.soa_template_row_id);
    if (id === null || soaId === null) return null;
    if (itemId === null && templateRowId === null) return null;
    return {
        id,
        soa_id: soaId,
        item_id: itemId,
        soa_template_row_id: templateRowId,
        description: toNullableText(raw.description),
        amount: toNullableAmount(raw.amount),
        remarks: toNullableText(raw.remarks),
        sort_order: toId(raw.sort_order) ?? 0,
    };
}

function normalizeSignatories(raw: unknown): SoaSignatory[] | null {
    if (raw === null || raw === undefined) return null;
    let parsed: unknown = raw;
    if (typeof raw === "string") {
        if (raw.trim() === "") return null;
        try {
            parsed = JSON.parse(raw) as unknown;
        } catch {
            return null;
        }
    }
    const checked = SoaSignatoriesSchema.safeParse(parsed);
    return checked.success ? checked.data : null;
}

function normalizeGroup(raw: unknown): SoaRowGroup | null {
    if (!isRecord(raw)) return null;
    const id = toId(raw.id);
    const label = toNullableText(raw.label);
    if (id === null || label === null) return null;
    return { id, label, sort_order: toId(raw.sort_order) ?? 0 };
}

function normalizeDetail(raw: unknown): SoaDetail | null {
    if (!isRecord(raw)) return null;
    const id = toId(raw.id);
    const requestId = toId(raw.request_id);
    const status = toStatus(raw.status);
    if (id === null || requestId === null || status === null) return null;
    const lines: SoaDetailLine[] = [];
    if (Array.isArray(raw.lines)) {
        for (const entry of raw.lines as unknown[]) {
            const line = normalizeLine(entry);
            if (line) lines.push(line);
        }
    }
    const groups: SoaRowGroup[] = [];
    if (Array.isArray(raw.groups)) {
        for (const entry of raw.groups as unknown[]) {
            const group = normalizeGroup(entry);
            if (group) groups.push(group);
        }
    }
    groups.sort((left, right) => left.sort_order - right.sort_order || left.id - right.id);
    return {
        id,
        request_id: requestId,
        status,
        ref_no: toNullableText(raw.ref_no),
        clearance_no: toNullableText(raw.clearance_no),
        company_code: toNullableText(raw.company_code),
        signatories: normalizeSignatories(raw.signatories),
        pdf_file: toNullableText(raw.pdf_file),
        approved_at: toNullableText(raw.approved_at),
        lines,
        groups,
    };
}

function normalizeItem(raw: unknown): SoaRequestItem | null {
    if (!isRecord(raw)) return null;
    const id = toId(raw.id);
    const label = toNullableText(raw.label_snapshot);
    if (id === null || label === null) return null;
    return { id, label_snapshot: label, sort_order: toId(raw.sort_order) ?? 0 };
}

function normalizeRenderModel(raw: unknown): SoaPrintInput | null {
    if (!isRecord(raw)) return null;
    if (!Array.isArray(raw.lines) || !Array.isArray(raw.signatories)) return null;
    if (
        typeof raw.refNo !== "string" ||
        typeof raw.clearanceNo !== "string" ||
        typeof raw.employeeName !== "string" ||
        typeof raw.position !== "string" ||
        typeof raw.dateOfSeparation !== "string" ||
        typeof raw.companyName !== "string" ||
        typeof raw.companyAddress !== "string"
    ) {
        return null;
    }
    return raw as unknown as SoaPrintInput;
}

function readErrorMessage(json: unknown, fallback: string): string {
    if (isRecord(json) && typeof json.message === "string" && json.message.trim() !== "") {
        return json.message;
    }
    return fallback;
}

export function useSoaDetail(requestId: number | null) {
    const [detail, setDetail] = useState<SoaDetail | null>(null);
    const [items, setItems] = useState<SoaRequestItem[]>([]);
    const [templateId, setTemplateId] = useState<number | null>(null);
    const [formClearanceNo, setFormClearanceNo] = useState<string>("");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async (id: number) => {
        setLoading(true);
        setError(null);
        try {
            const [soaRes, reqRes] = await Promise.all([
                fetch(`${BY_REQUEST_API}?request_id=${id}`, { cache: "no-store" }),
                fetch(`/api/hrm/clearance/requests/${id}`, { cache: "no-store" }),
            ]);
            const soaJson: unknown = await soaRes.json().catch(() => null);
            if (!soaRes.ok || !isRecord(soaJson) || soaJson.success !== true) {
                throw new Error(readErrorMessage(soaJson, "Could not load the statement of account."));
            }
            const parsed = normalizeDetail(soaJson.data);
            if (!parsed) throw new Error("Could not load the statement of account.");
            const reqJson: unknown = await reqRes.json().catch(() => null);
            const reqItems: SoaRequestItem[] = [];
            if (reqRes.ok && isRecord(reqJson) && reqJson.success === true && isRecord(reqJson.data)) {
                const rawItems = (reqJson.data as Record<string, unknown>).items;
                if (Array.isArray(rawItems)) {
                    for (const entry of rawItems as unknown[]) {
                        const item = normalizeItem(entry);
                        if (item) reqItems.push(item);
                    }
                }
            }
            reqItems.sort((left, right) => left.sort_order - right.sort_order || left.id - right.id);
            setDetail(parsed);
            setItems(reqItems);
            try {
                const formRes = await fetch(`/api/hrm/clearance/form/by-request?request_id=${id}`, {
                    cache: "no-store",
                });
                const formJson: unknown = await formRes.json().catch(() => null);
                if (
                    formRes.ok &&
                    isRecord(formJson) &&
                    formJson.success === true &&
                    isRecord(formJson.data)
                ) {
                    setFormClearanceNo(toNullableText(formJson.data.ref_no) ?? "");
                } else {
                    setFormClearanceNo("");
                }
            } catch {
                setFormClearanceNo("");
            }
            const rawTemplate = isRecord(reqJson) && isRecord(reqJson.data)
                ? toId((reqJson.data as Record<string, unknown>).template_id)
                : null;
            setTemplateId(rawTemplate);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Could not load the statement of account.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (requestId === null) {
            setLoading(false);
            return;
        }
        void load(requestId);
    }, [load, requestId]);

    const reload = useCallback(async (): Promise<void> => {
        if (requestId !== null) await load(requestId);
    }, [load, requestId]);

    const saveLines = useCallback(async (soaId: number, lines: SoaLinePayload[], signatories?: SoaSignatory[]): Promise<SoaDetailLine[]> => {
        const res = await fetch(`/api/hrm/clearance/soa/${soaId}/lines`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(signatories === undefined ? { lines } : { lines, signatories }),
        });
        const json: unknown = await res.json().catch(() => null);
        if (!res.ok || !isRecord(json) || json.success !== true) {
            throw new Error(readErrorMessage(json, "Could not save the SOA lines. Please try again."));
        }
        const data: unknown = isRecord(json) ? json.data : null;
        if (!Array.isArray(data)) return [];
        const rows: SoaDetailLine[] = [];
        for (const entry of data as unknown[]) {
            const line = normalizeLine(entry);
            if (line) rows.push(line);
        }
        return rows;
    }, []);

    const approve = useCallback(async (id: number, companyCode: string): Promise<string> => {
        const res = await fetch(APPROVE_API, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ request_id: id, company_code: companyCode }),
        });
        const json: unknown = await res.json().catch(() => null);
        if (!res.ok || !isRecord(json) || json.success !== true) {
            throw new Error(readErrorMessage(json, "The statement of account cannot be approved."));
        }
        const ref = isRecord(json.data) && isRecord(json.data.ref)
            ? toNullableText((json.data.ref as Record<string, unknown>).ref_no)
            : null;
        return ref ?? "";
    }, []);

    const fetchRenderModel = useCallback(
        async (id: number, company: SoaCompanyPayload): Promise<SoaPrintInput> => {
            const res = await fetch(RENDER_MODEL_API, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ request_id: id, company }),
            });
            const json: unknown = await res.json().catch(() => null);
            if (!res.ok || !isRecord(json) || json.success !== true) {
                throw new Error(readErrorMessage(json, "Could not build the SOA preview."));
            }
            const model = normalizeRenderModel(json.data);
            if (!model) throw new Error("Could not build the SOA preview.");
            if (model.clearanceNo === "") {
                try {
                    const formRes = await fetch(`/api/hrm/clearance/form/by-request?request_id=${id}`, {
                        cache: "no-store",
                    });
                    const formJson: unknown = await formRes.json().catch(() => null);
                    if (
                        formRes.ok &&
                        isRecord(formJson) &&
                        formJson.success === true &&
                        isRecord(formJson.data)
                    ) {
                        const ref = toNullableText((formJson.data as Record<string, unknown>).ref_no) ?? "";
                        if (ref !== "") return { ...model, clearanceNo: ref };
                    }
                } catch {
                    return model;
                }
            }
            return model;
        },
        []
    );

    return { detail, items, templateId, formClearanceNo, loading, error, reload, saveLines, approve, fetchRenderModel };
}
