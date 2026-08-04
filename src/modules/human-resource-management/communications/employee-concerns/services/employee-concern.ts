import {
    EnrichedEmployeeConcern,
    EmployeeConcern,
    ConcernStatus,
    parseBit,
    EnrichedEmployeeConcernAttachment,
} from "../types/employee-concern.schema";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
const STATIC_TOKEN = process.env.DIRECTUS_STATIC_TOKEN;

const headers = {
    Authorization: `Bearer ${STATIC_TOKEN}`,
    "Content-Type": "application/json",
};

/**
 * Employee Concern Service
 *
 * Server-only (no "use client"). Imported exclusively by the API route
 * handler. Calls Directus REST `/items/employee_concerns` with the static
 * token. `user_id` and `created_by` are M2O relations to the `user` collection.
 */
export const employeeConcernService = {
    /**
     * Fetches all concerns with user relations, newest first.
     * @param {ConcernStatus} [statusFilter] - Optional status to filter by.
     * @returns {Promise<EnrichedEmployeeConcern[]>} Enriched list for the DataTable.
     */
    async fetchAll(statusFilter?: ConcernStatus): Promise<EnrichedEmployeeConcern[]> {
        try {
            let url =
                `${API_BASE_URL}/items/employee_concerns` +
                `?fields=*,user_id.user_id,user_id.user_fname,user_id.user_lname,user_id.user_email,` +
                `created_by.user_id,created_by.user_fname,created_by.user_lname` +
                `&sort=-created_at`;

            if (statusFilter) {
                url += `&filter[status][_eq]=${statusFilter}`;
            }

            const response = await fetch(url, { headers });
            if (!response.ok) {
                const errorText = await response.text();
                console.error(`DIRECTUS ERROR [fetchAll]:`, errorText);
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const result = await response.json();
            const rows: Record<string, unknown>[] = result.data;

            return rows.map((row) => normalizeConcern(row));
        } catch (e) {
            const error = e as Error;
            console.error("Error fetching employee concerns:", error);
            throw new Error("INTERNAL_FAIL: Failed to fetch employee concerns");
        }
    },

    /**
     * Fetches a single concern by id (with relations).
     * @param {number} id - The concern id.
     * @returns {Promise<EnrichedEmployeeConcern | null>} The concern or null if not found.
     */
    async fetchById(id: number): Promise<EnrichedEmployeeConcern | null> {
        try {
            const url =
                `${API_BASE_URL}/items/employee_concerns/${id}` +
                `?fields=*,user_id.user_id,user_id.user_fname,user_id.user_lname,user_id.user_email,` +
                `created_by.user_id,created_by.user_fname,created_by.user_lname`;

            const response = await fetch(url, { headers });
            if (response.status === 404) return null;
            if (!response.ok) {
                const errorText = await response.text();
                console.error(`DIRECTUS ERROR [fetchById:${id}]:`, errorText);
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const result = await response.json();
            return normalizeConcern(result.data);
        } catch (e) {
            const error = e as Error;
            console.error("Error fetching employee concern:", error);
            throw new Error("INTERNAL_FAIL: Failed to fetch employee concern");
        }
    },

    /**
     * Creates a new concern. `user_id` and `created_by` are injected server-side
     * from the JWT (the logged-in employee).
     * @param {EmployeeConcern} concern - The concern payload.
     * @returns {Promise<EnrichedEmployeeConcern>} The created concern.
     */
    async create(concern: EmployeeConcern): Promise<EnrichedEmployeeConcern> {
        try {
            const body: Record<string, unknown> = {
                subject_of_concern: concern.subject_of_concern,
                concern: concern.concern,
                is_anonymous: concern.is_anonymous,
                status: concern.status ?? "PENDING",
            };
            if (concern.user_id != null) body.user_id = concern.user_id;
            if (concern.created_by != null) body.created_by = concern.created_by;

            const response = await fetch(`${API_BASE_URL}/items/employee_concerns`, {
                method: "POST",
                headers,
                body: JSON.stringify(body),
            });
            if (!response.ok) {
                const errorText = await response.text();
                console.error(`DIRECTUS ERROR [create]:`, errorText);
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const result = await response.json();
            return normalizeConcern(result.data);
        } catch (e) {
            const error = e as Error;
            console.error("Error creating employee concern:", error);
            throw new Error("VALIDATION_FAILED: Failed to submit concern");
        }
    },

    /**
     * Updates the status of a concern (admin action).
     * @param {number} id - The concern id.
     * @param {ConcernStatus} status - The new status.
     * @returns {Promise<void>}
     */
    async updateStatus(id: number, status: ConcernStatus): Promise<void> {
        try {
            const response = await fetch(`${API_BASE_URL}/items/employee_concerns/${id}`, {
                method: "PATCH",
                headers,
                body: JSON.stringify({ status }),
            });
            if (!response.ok) {
                const errorText = await response.text();
                console.error(`DIRECTUS ERROR [updateStatus:${id}]:`, errorText);
                throw new Error(`HTTP error! status: ${response.status}`);
            }
        } catch (e) {
            const error = e as Error;
            console.error("Error updating concern status:", error);
            throw new Error("VALIDATION_FAILED: Failed to update concern status");
        }
    },

    /**
     * Deletes a concern permanently.
     * @param {number} id - The concern id.
     * @returns {Promise<void>}
     */
    async remove(id: number): Promise<void> {
        try {
            const response = await fetch(`${API_BASE_URL}/items/employee_concerns/${id}`, {
                method: "DELETE",
                headers,
            });
            if (!response.ok) {
                const errorText = await response.text();
                console.error(`DIRECTUS ERROR [delete:${id}]:`, errorText);
                throw new Error(`HTTP error! status: ${response.status}`);
            }
        } catch (e) {
            const error = e as Error;
            console.error("Error deleting employee concern:", error);
            throw new Error("INTERNAL_FAIL: Failed to delete concern");
        }
    },

    /**
     * Fetches all attachments for a given concern, newest first.
     * `created_by` is an M2O relation to the `user` collection.
     * @param {number} concernId - The parent concern id.
     * @returns {Promise<EnrichedEmployeeConcernAttachment[]>}
     */
    async fetchAttachmentsByConcernId(
        concernId: number,
    ): Promise<EnrichedEmployeeConcernAttachment[]> {
        try {
            const url =
                `${API_BASE_URL}/items/employee_concern_attachments` +
                `?fields=*,created_by.user_id,created_by.user_fname,created_by.user_lname` +
                `&filter[concern_id][_eq]=${concernId}` +
                `&sort=-created_at`;

            const response = await fetch(url, { headers });
            if (!response.ok) {
                const errorText = await response.text();
                console.error(`DIRECTUS ERROR [fetchAttachments:${concernId}]:`, errorText);
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const result = await response.json();
            const rows: Record<string, unknown>[] = result.data;
            return rows.map((row) => normalizeAttachment(row, concernId));
        } catch (e) {
            const error = e as Error;
            console.error("Error fetching attachments:", error);
            throw new Error("INTERNAL_FAIL: Failed to fetch attachments");
        }
    },

    /**
     * Fetches a single attachment by id (with creator relation).
     * Used by the file-streaming proxy endpoint.
     * @param {number} concernId - The parent concern id (scoped for safety).
     * @param {number} attachmentId - The attachment id.
     * @returns {Promise<EnrichedEmployeeConcernAttachment | null>}
     */
    async fetchAttachmentById(
        concernId: number,
        attachmentId: number,
    ): Promise<EnrichedEmployeeConcernAttachment | null> {
        try {
            const url =
                `${API_BASE_URL}/items/employee_concern_attachments/${attachmentId}` +
                `?fields=*,created_by.user_id,created_by.user_fname,created_by.user_lname` +
                `&filter[concern_id][_eq]=${concernId}`;

            const response = await fetch(url, { headers });
            if (response.status === 404) return null;
            if (!response.ok) {
                const errorText = await response.text();
                console.error(`DIRECTUS ERROR [fetchAttachment:${attachmentId}]:`, errorText);
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const result = await response.json();
            return normalizeAttachment(result.data, concernId);
        } catch (e) {
            const error = e as Error;
            console.error("Error fetching attachment:", error);
            throw new Error("INTERNAL_FAIL: Failed to fetch attachment");
        }
    },

    /**
     * Resolves a stored `file_path` to a fully-qualified URL that the server
     * can fetch with the Directus static token. Handles absolute URLs,
     * Directus `/assets/...` paths, and bare relative paths.
     * @param {string} filePath - The raw file_path from the DB.
     * @returns {string}
     */
    resolveFileUrl(filePath: string): string {
        if (/^https?:\/\//i.test(filePath)) return filePath;
        if (filePath.startsWith("/")) return `${API_BASE_URL}${filePath}`;
        return `${API_BASE_URL}/${filePath}`;
    },
};

/**
 * Normalizes a raw Directus row into an EnrichedEmployeeConcern.
 * Unpacks the M2O `user_id` / `created_by` relation objects and parses the
 * `is_anonymous` bit defensively.
 */
function normalizeConcern(row: Record<string, unknown>): EnrichedEmployeeConcern {
    const userObj = row.user_id as Record<string, unknown> | number | null;
    const creatorObj = row.created_by as Record<string, unknown> | number | null;

    const userIsObj = userObj && typeof userObj === "object";
    const creatorIsObj = creatorObj && typeof creatorObj === "object";

    return {
        id: row.id as number,
        user_id: userIsObj ? (userObj.user_id as number) : (userObj as number | null) ?? null,
        subject_of_concern: row.subject_of_concern as string,
        concern: row.concern as string,
        is_anonymous: parseBit(row.is_anonymous),
        status: row.status as ConcernStatus,
        created_at: (row.created_at as string) ?? null,
        created_by: creatorIsObj ? (creatorObj.user_id as number) : (creatorObj as number | null) ?? null,
        user_name: userIsObj
            ? `${userObj.user_fname ?? ""} ${userObj.user_lname ?? ""}`.trim() || undefined
            : undefined,
        user_email: userIsObj ? (userObj.user_email as string) ?? undefined : undefined,
        created_by_name: creatorIsObj
            ? `${creatorObj.user_fname ?? ""} ${creatorObj.user_lname ?? ""}`.trim() || undefined
            : undefined,
    };
}

/**
 * Normalizes a raw Directus attachment row into an EnrichedEmployeeConcernAttachment.
 * Unpacks the M2O `created_by` relation object. `view_url` is left unset here —
 * the API route populates it with the client-safe proxy URL.
 */
function normalizeAttachment(
    row: Record<string, unknown>,
    concernId: number,
): EnrichedEmployeeConcernAttachment {
    const creatorObj = row.created_by as Record<string, unknown> | number | null;
    const creatorIsObj = creatorObj && typeof creatorObj === "object";

    return {
        id: row.id as number,
        concern_id: (row.concern_id as number) ?? concernId,
        file_path: row.file_path as string,
        file_name: row.file_name as string,
        file_type: (row.file_type as string) ?? null,
        created_at: (row.created_at as string) ?? null,
        created_by: creatorIsObj
            ? (creatorObj.user_id as number)
            : (creatorObj as number | null) ?? null,
        updated_at: (row.updated_at as string) ?? null,
        updated_by: (row.updated_by as number) ?? null,
        created_by_name: creatorIsObj
            ? `${creatorObj.user_fname ?? ""} ${creatorObj.user_lname ?? ""}`.trim() || undefined
            : undefined,
    };
}
