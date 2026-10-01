import { nowUTC } from "@/modules/human-resource-management/resignation/utils/audit";
import {
    type EnrichedResignationRequest,
    type ResignationRequest,
    type ResignationStatus,
} from "../types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
const STATIC_TOKEN = process.env.DIRECTUS_STATIC_TOKEN;

const headers = {
    Authorization: `Bearer ${STATIC_TOKEN}`,
    "Content-Type": "application/json",
};

export type ResignationFilingCreateInput = {
    user_id: number;
    resignation_date: string;
    reason: string;
    attachment_uuid: string | null;
    attachment_name: string | null;
    attachment_type: string | null;
    filed_at: string;
};

export const resignationFilingService = {
    async fetchByUser(userId: number): Promise<EnrichedResignationRequest[]> {
        try {
            const response = await fetch(
                `${API_BASE_URL}/items/resignation_request?filter[user_id][_eq]=${userId}&sort=-filed_at&limit=-1&fields=*`,
                { headers }
            );
            if (!response.ok) {
                const errorText = await response.text();
                console.error(`DIRECTUS ERROR [fetchByUser:${userId}]:`, errorText);
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const result = await response.json();
            const rows: Record<string, unknown>[] = Array.isArray(result.data) ? result.data : [];
            return rows.map((row) => normalizeResignationRequest(row));
        } catch (error) {
            console.error("Error fetching resignation filings:", error);
            throw new Error("INTERNAL_FAIL: Failed to fetch resignation filings");
        }
    },
    async create(input: ResignationFilingCreateInput): Promise<ResignationRequest> {
        try {
            const body: Record<string, unknown> = {
                user_id: input.user_id,
                resignation_date: input.resignation_date,
                reason: input.reason,
                status: "pending",
                attachment_uuid: input.attachment_uuid,
                attachment_name: input.attachment_name,
                attachment_type: input.attachment_type,
                filed_at: input.filed_at,
                created_by: input.user_id,
            };
            const response = await fetch(`${API_BASE_URL}/items/resignation_request`, {
                method: "POST",
                headers,
                body: JSON.stringify(body),
            });
            if (!response.ok) {
                const errorText = await response.text();
                console.error("DIRECTUS ERROR [create]:", errorText);
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const result = await response.json();
            const created: Record<string, unknown> = result.data ?? {};
            return normalizeResignationRequest(created);
        } catch (error) {
            console.error("Error creating resignation filing:", error);
            throw new Error("VALIDATION_FAILED: Failed to submit resignation");
        }
    },
    async withdraw(id: number, userId: number): Promise<"withdrawn" | "not_found" | "not_pending"> {
        try {
            const detailResponse = await fetch(
                `${API_BASE_URL}/items/resignation_request/${id}?fields=id,user_id,status`,
                { headers }
            );
            if (!detailResponse.ok) {
                return "not_found";
            }
            const detailResult = await detailResponse.json();
            const detail: Record<string, unknown> | null = detailResult.data ?? null;
            if (detail === null || typeof detail !== "object") {
                return "not_found";
            }
            const ownerId = toNullableId(detail.user_id);
            if (ownerId === null || ownerId !== userId) {
                return "not_found";
            }
            if (detail.status !== "pending") {
                return "not_pending";
            }
            const patchResponse = await fetch(`${API_BASE_URL}/items/resignation_request/${id}`, {
                method: "PATCH",
                headers,
                body: JSON.stringify({
                    status: "withdrawn",
                    updated_at: nowUTC(),
                    updated_by: userId,
                }),
            });
            if (!patchResponse.ok) {
                const errorText = await patchResponse.text();
                console.error(`DIRECTUS ERROR [withdraw:${id}]:`, errorText);
                throw new Error(`HTTP error! status: ${patchResponse.status}`);
            }
            return "withdrawn";
        } catch (error) {
            console.error("Error withdrawing resignation filing:", error);
            throw new Error("INTERNAL_FAIL: Failed to withdraw resignation filing");
        }
    },
};

function toStatus(value: unknown): ResignationStatus {
    if (value === "pending" || value === "approved" || value === "rejected" || value === "withdrawn") {
        return value;
    }
    return "pending";
}

function toText(value: unknown): string {
    return typeof value === "string" ? value : "";
}

function toNullableText(value: unknown): string | null {
    return typeof value === "string" ? value : null;
}

function toId(value: unknown): number {
    if (typeof value === "number" && Number.isFinite(value)) {
        return value;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
}

function toNullableId(value: unknown): number | null {
    if (value === null || value === undefined) {
        return null;
    }
    if (typeof value === "number" && Number.isFinite(value)) {
        return value;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

function normalizeResignationRequest(row: Record<string, unknown>): EnrichedResignationRequest {
    return {
        id: toId(row.id),
        user_id: toId(row.user_id),
        resignation_date: toText(row.resignation_date),
        reason: toText(row.reason),
        status: toStatus(row.status),
        attachment_uuid: toNullableText(row.attachment_uuid),
        attachment_name: toNullableText(row.attachment_name),
        attachment_type: toNullableText(row.attachment_type),
        hr_remarks: toNullableText(row.hr_remarks),
        reviewed_by: toNullableId(row.reviewed_by),
        reviewed_at: toNullableText(row.reviewed_at),
        filed_at: toNullableText(row.filed_at),
        created_by: toNullableId(row.created_by),
        updated_at: toNullableText(row.updated_at),
        updated_by: toNullableId(row.updated_by),
    };
}
