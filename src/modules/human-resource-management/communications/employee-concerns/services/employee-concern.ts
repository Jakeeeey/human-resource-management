import {
    EnrichedEmployeeConcern,
    EmployeeConcern,
    ConcernStatus,
    parseBit,
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
