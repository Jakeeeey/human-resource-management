import {
    EnrichedCompanyMemo,
    CompanyMemo,
    CompanyMemoStatus,
    CompanyMemoPriority,
} from "../types/company-memo.schema";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
const STATIC_TOKEN = process.env.DIRECTUS_STATIC_TOKEN;

const headers = {
    Authorization: `Bearer ${STATIC_TOKEN}`,
    "Content-Type": "application/json",
};

/**
 * Company Memo Service
 *
 * Server-only (no "use client"). Imported exclusively by the API route
 * handler. Calls Directus REST `/items/company_memos` with the static
 * token. `created_by` and `updated_by` are M2O relations to the `user` collection.
 */
export const companyMemoService = {
    /**
     * Fetches all memos with user relations, newest first.
     * @returns {Promise<EnrichedCompanyMemo[]>} Enriched list for the DataTable.
     */
    async fetchAll(): Promise<EnrichedCompanyMemo[]> {
        try {
            const url =
                `${API_BASE_URL}/items/company_memos` +
                `?fields=*,created_by.user_id,created_by.user_fname,created_by.user_lname,` +
                `updated_by.user_id,updated_by.user_fname,updated_by.user_lname` +
                `&sort=-created_at`;

            const response = await fetch(url, { headers });
            if (!response.ok) {
                const errorText = await response.text();
                console.error(`DIRECTUS ERROR [fetchAll]:`, errorText);
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const result = await response.json();
            const rows: Record<string, unknown>[] = result.data;

            return rows.map((row) => normalizeMemo(row));
        } catch (e) {
            const error = e as Error;
            console.error("Error fetching company memos:", error);
            throw new Error("INTERNAL_FAIL: Failed to fetch company memos");
        }
    },

    /**
     * Fetches a single memo by id (with relations).
     * @param {number} id - The memo id.
     * @returns {Promise<EnrichedCompanyMemo | null>} The memo or null if not found.
     */
    async fetchById(id: number): Promise<EnrichedCompanyMemo | null> {
        try {
            const url =
                `${API_BASE_URL}/items/company_memos/${id}` +
                `?fields=*,created_by.user_id,created_by.user_fname,created_by.user_lname,` +
                `updated_by.user_id,updated_by.user_fname,updated_by.user_lname`;

            const response = await fetch(url, { headers });
            if (response.status === 404) return null;
            if (!response.ok) {
                const errorText = await response.text();
                console.error(`DIRECTUS ERROR [fetchById:${id}]:`, errorText);
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const result = await response.json();
            return normalizeMemo(result.data);
        } catch (e) {
            const error = e as Error;
            console.error("Error fetching company memo:", error);
            throw new Error("INTERNAL_FAIL: Failed to fetch company memo");
        }
    },

    /**
     * Creates a new memo.
     * @param {CompanyMemo} memo - The memo payload.
     * @returns {Promise<EnrichedCompanyMemo>} The created memo.
     */
    async create(memo: CompanyMemo): Promise<EnrichedCompanyMemo> {
        try {
            const body: Record<string, unknown> = {
                title: memo.title,
                content: memo.content,
                attachment: memo.attachment ?? null,
                status: memo.status ?? "DRAFT",
                priority: memo.priority ?? "NORMAL",
            };
            if (memo.created_by != null) body.created_by = memo.created_by;

            const response = await fetch(`${API_BASE_URL}/items/company_memos`, {
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
            return normalizeMemo(result.data);
        } catch (e) {
            const error = e as Error;
            console.error("Error creating company memo:", error);
            throw new Error("VALIDATION_FAILED: Failed to submit memo");
        }
    },

    /**
     * Updates an existing memo.
     * @param {number} id - The memo id.
     * @param {Partial<CompanyMemo>} data - The fields to update.
     * @returns {Promise<EnrichedCompanyMemo>}
     */
    async update(id: number, data: Partial<CompanyMemo>): Promise<EnrichedCompanyMemo> {
        try {
            const response = await fetch(`${API_BASE_URL}/items/company_memos/${id}`, {
                method: "PATCH",
                headers,
                body: JSON.stringify(data),
            });
            if (!response.ok) {
                const errorText = await response.text();
                console.error(`DIRECTUS ERROR [update:${id}]:`, errorText);
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const result = await response.json();
            return normalizeMemo(result.data);
        } catch (e) {
            const error = e as Error;
            console.error("Error updating memo:", error);
            throw new Error("VALIDATION_FAILED: Failed to update memo");
        }
    },

    /**
     * Deletes a memo permanently.
     * @param {number} id - The memo id.
     * @returns {Promise<void>}
     */
    async remove(id: number): Promise<void> {
        try {
            const response = await fetch(`${API_BASE_URL}/items/company_memos/${id}`, {
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
            console.error("Error deleting company memo:", error);
            throw new Error("INTERNAL_FAIL: Failed to delete memo");
        }
    },
};

/**
 * Normalizes a raw Directus row into an EnrichedCompanyMemo.
 * Unpacks the M2O `created_by` / `updated_by` relation objects.
 */
function normalizeMemo(row: Record<string, unknown>): EnrichedCompanyMemo {
    const creatorObj = row.created_by as Record<string, unknown> | number | null;
    const updaterObj = row.updated_by as Record<string, unknown> | number | null;

    const creatorIsObj = creatorObj && typeof creatorObj === "object";
    const updaterIsObj = updaterObj && typeof updaterObj === "object";

    return {
        id: row.id as number,
        title: row.title as string,
        content: row.content as string,
        attachment: (row.attachment as string) ?? null,
        status: row.status as CompanyMemoStatus,
        priority: row.priority as CompanyMemoPriority,
        published_at: (row.published_at as string) ?? null,
        created_at: (row.created_at as string) ?? null,
        created_by: creatorIsObj ? (creatorObj.user_id as number) : (creatorObj as number | null) ?? null,
        updated_at: (row.updated_at as string) ?? null,
        updated_by: updaterIsObj ? (updaterObj.user_id as number) : (updaterObj as number | null) ?? null,
        created_by_name: creatorIsObj
            ? `${creatorObj.user_fname ?? ""} ${creatorObj.user_lname ?? ""}`.trim() || undefined
            : undefined,
        updated_by_name: updaterIsObj
            ? `${updaterObj.user_fname ?? ""} ${updaterObj.user_lname ?? ""}`.trim() || undefined
            : undefined,
    };
}
