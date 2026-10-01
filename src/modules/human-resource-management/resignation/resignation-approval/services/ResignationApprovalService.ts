import { nowUTC } from "@/modules/human-resource-management/resignation/utils/audit";
import type { ResignationRequestWithUser } from "../types";

const DIRECTUS_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

interface DirectusUserRow {
    user_id: number;
    user_fname: string | null;
    user_lname: string | null;
    user_mname: string | null;
    user_department: number | null;
}

interface DirectusDepartmentRow {
    department_id: number;
    department_name: string | null;
}

interface ReviewInput {
    id: number;
    status: "approved" | "rejected";
    remarks: string;
    reviewerId: number;
}

interface AttachmentRef {
    fileId: string;
    fileName: string | null;
    fileType: string | null;
}

function staticToken(): string {
    return process.env.DIRECTUS_STATIC_TOKEN || "";
}

async function directusGet(path: string): Promise<{ data?: unknown }> {
    const response = await fetch(`${DIRECTUS_URL}${path}`, {
        headers: {
            Authorization: `Bearer ${staticToken()}`,
        },
        cache: "no-store",
    });
    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Directus API error: ${response.status} - ${error}`);
    }
    return response.json();
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

function toUserRow(value: unknown): DirectusUserRow | null {
    if (!isRecord(value)) {
        return null;
    }
    const userId = Number(value.user_id);
    if (Number.isNaN(userId)) {
        return null;
    }
    const departmentRaw = value.user_department;
    const departmentId = typeof departmentRaw === "number" ? departmentRaw : Number(departmentRaw);
    return {
        user_id: userId,
        user_fname: typeof value.user_fname === "string" ? value.user_fname : null,
        user_lname: typeof value.user_lname === "string" ? value.user_lname : null,
        user_mname: typeof value.user_mname === "string" ? value.user_mname : null,
        user_department: Number.isNaN(departmentId) ? null : departmentId,
    };
}

function toDepartmentRow(value: unknown): DirectusDepartmentRow | null {
    if (!isRecord(value)) {
        return null;
    }
    const departmentId = Number(value.department_id);
    if (Number.isNaN(departmentId)) {
        return null;
    }
    return {
        department_id: departmentId,
        department_name: typeof value.department_name === "string" ? value.department_name : null,
    };
}

export const resignationApprovalService = {
    async fetchPending(): Promise<ResignationRequestWithUser[]> {
        const pendingResponse = await directusGet(
            "/items/resignation_request?filter[status][_eq]=pending&sort=-filed_at&limit=-1&fields=*"
        );
        const rows = Array.isArray(pendingResponse.data) ? pendingResponse.data : [];
        const userIds = [...new Set(
            rows
                .map((row) => (isRecord(row) ? Number(row.user_id) : Number.NaN))
                .filter((id) => !Number.isNaN(id))
        )];
        const usersResults = await Promise.all(
            userIds.map((id) =>
                directusGet(`/items/user/${id}?fields=user_id,user_fname,user_lname,user_mname,user_department`)
                    .then((result) => toUserRow(result.data))
                    .catch(() => null)
            )
        );
        const usersMap = new Map<number, DirectusUserRow>();
        for (const user of usersResults) {
            if (user) {
                usersMap.set(user.user_id, user);
            }
        }
        const departmentIds = [...new Set(
            [...usersMap.values()]
                .map((user) => user.user_department)
                .filter((id): id is number => typeof id === "number")
        )];
        const departmentsResults = await Promise.all(
            departmentIds.map((id) =>
                directusGet(`/items/department/${id}?fields=department_id,department_name`)
                    .then((result) => toDepartmentRow(result.data))
                    .catch(() => null)
            )
        );
        const departmentsMap = new Map<number, DirectusDepartmentRow>();
        for (const department of departmentsResults) {
            if (department) {
                departmentsMap.set(department.department_id, department);
            }
        }
        return rows
            .filter((row): row is Record<string, unknown> => isRecord(row))
            .map((row) => {
                const userId = Number(row.user_id);
                const user = usersMap.get(userId);
                const department = user && user.user_department !== null
                    ? departmentsMap.get(user.user_department)
                    : undefined;
                const id = Number(row.id);
                const attachmentUuid = typeof row.attachment_uuid === "string" ? row.attachment_uuid : null;
                return {
                    ...row,
                    user_fname: user && user.user_fname ? user.user_fname : "Unknown",
                    user_lname: user && user.user_lname ? user.user_lname : "",
                    user_mname: user && user.user_mname ? user.user_mname : null,
                    department_name: department && department.department_name ? department.department_name : null,
                    reviewer_name: null,
                    view_file_url: attachmentUuid
                        ? `/api/hrm/resignation/resignation-approval/${id}/file`
                        : null,
                } as ResignationRequestWithUser;
            });
    },
    async review(input: ReviewInput): Promise<void> {
        const timestamp = nowUTC();
        const response = await fetch(`${DIRECTUS_URL}/items/resignation_request/${input.id}`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${staticToken()}`,
            },
            body: JSON.stringify({
                status: input.status,
                hr_remarks: input.remarks,
                reviewed_by: input.reviewerId,
                reviewed_at: timestamp,
                updated_at: timestamp,
                updated_by: input.reviewerId,
            }),
        });
        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Directus API error: ${response.status} - ${error}`);
        }
    },
    async fetchAttachmentFileId(id: number): Promise<AttachmentRef | null> {
        const result = await directusGet(
            `/items/resignation_request/${id}?fields=attachment_uuid,attachment_name,attachment_type`
        );
        if (!isRecord(result.data)) {
            return null;
        }
        const fileId = typeof result.data.attachment_uuid === "string" ? result.data.attachment_uuid : null;
        if (!fileId) {
            return null;
        }
        return {
            fileId,
            fileName: typeof result.data.attachment_name === "string" ? result.data.attachment_name : null,
            fileType: typeof result.data.attachment_type === "string" ? result.data.attachment_type : null,
        };
    },
};
