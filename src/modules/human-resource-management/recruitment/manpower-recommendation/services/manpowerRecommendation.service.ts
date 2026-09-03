import { ManpowerRecommendation, ManpowerRecommendationCreateInput } from "../types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
const STATIC_TOKEN = process.env.DIRECTUS_STATIC_TOKEN;

const headers = {
    Authorization: `Bearer ${STATIC_TOKEN}`,
    "Content-Type": "application/json",
};

export const manpowerRecommendationService = {
    /**
     * Fetch all manpower recommendations, newest first.
     * @returns All manpower recommendation records.
     */
    async fetchAll(): Promise<ManpowerRecommendation[]> {
        try {
            const url =
                `${API_BASE_URL}/items/manpower_recommendation` +
                `?fields=*&sort=-created_at&limit=-1`;

            const response = await fetch(url, { headers });
            if (!response.ok) {
                const errorText = await response.text();
                console.error(`DIRECTUS ERROR [fetchAll]:`, errorText);
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const result = await response.json();
            const rows: Record<string, unknown>[] = result.data;

            if (rows.length === 0) return [];
            return rows.map(normalizeRecommendation);
        } catch (e) {
            console.error("Error fetching manpower recommendations:", e);
            throw new Error("INTERNAL_FAIL: Failed to fetch manpower recommendations");
        }
    },

    /**
     * Fetch a single manpower recommendation by ID.
     * @param id - Recommendation record ID.
     * @returns The recommendation record, or null when not found.
     */
    async fetchById(id: number): Promise<ManpowerRecommendation | null> {
        try {
            const url =
                `${API_BASE_URL}/items/manpower_recommendation/${id}` +
                `?fields=*`;

            const response = await fetch(url, { headers });
            if (response.status === 404) return null;
            if (!response.ok) {
                const errorText = await response.text();
                console.error(`DIRECTUS ERROR [fetchById:${id}]:`, errorText);
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const result = await response.json();
            return normalizeRecommendation(result.data);
        } catch (e) {
            console.error("Error fetching manpower recommendation:", e);
            throw new Error("INTERNAL_FAIL: Failed to fetch manpower recommendation");
        }
    },

    /**
     * Fetch applicants for the recommendation form dropdown.
     * @returns Typed applicant lookup rows.
     */
    async fetchApplicants(): Promise<{ id: number; full_name: string; position_applied_for: string }[]> {
        try {
            const url = `${API_BASE_URL}/items/applicant?fields=id,full_name,position_applied_for&sort=full_name&limit=-1`;
            const response = await fetch(url, { headers });
            if (!response.ok) return [];
            const result = await response.json();
            return result.data.map((a: { id: number; full_name: string; position_applied_for: string }) => ({
                id: a.id,
                full_name: a.full_name,
                position_applied_for: a.position_applied_for,
            }));
        } catch { return []; }
    },

    /**
     * Fetch open (Draft + Approved) manpower requests for the recommendation form dropdown.
     * @returns Typed open manpower request lookup rows.
     */
    async fetchOpenManpowerRequests(): Promise<{ id: number; request_no: string; position: string; no_manpower_needed: number; status: string }[]> {
        try {
            const url =
                `${API_BASE_URL}/items/manpower_request` +
                `?fields=id,request_no,position,no_manpower_needed,status` +
                `&filter[status][_in]=Draft,Approved` +
                `&sort=-created_at&limit=-1`;
            const response = await fetch(url, { headers });
            if (!response.ok) return [];
            const result = await response.json();
            return result.data.map((r: { id: number; request_no: string; position: string; no_manpower_needed: number; status: string }) => ({
                id: r.id,
                request_no: r.request_no,
                position: r.position,
                no_manpower_needed: r.no_manpower_needed,
                status: r.status,
            }));
        } catch { return []; }
    },

    /**
     * Create a new manpower recommendation, auto-filling recommended_at.
     * @param data - Recommendation create input.
     * @returns The created recommendation record.
     */
    async create(data: ManpowerRecommendationCreateInput): Promise<ManpowerRecommendation> {
        try {
            const body = { ...data, recommended_by: data.recommended_by ?? null, recommended_at: data.recommended_at ?? new Date().toISOString() };

            const response = await fetch(`${API_BASE_URL}/items/manpower_recommendation`, {
                method: "POST",
                headers,
                body: JSON.stringify(body),
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`DIRECTUS ERROR [create recommendation]:`, errorText);
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const result = await response.json();
            return normalizeRecommendation(result.data);
        } catch (e) {
            console.error("Error creating manpower recommendation:", e);
            throw new Error("VALIDATION_FAILED: Failed to submit manpower recommendation");
        }
    },

    /**
     * Update a manpower recommendation by ID.
     * @param id - Recommendation record ID.
     * @param data - Partial recommendation fields to update.
     * @returns The updated recommendation record.
     */
    async update(id: number, data: Partial<ManpowerRecommendation>): Promise<ManpowerRecommendation> {
        try {
            const response = await fetch(`${API_BASE_URL}/items/manpower_recommendation/${id}`, {
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
            return normalizeRecommendation(result.data);
        } catch (e) {
            console.error("Error updating manpower recommendation:", e);
            throw new Error("VALIDATION_FAILED: Failed to update manpower recommendation");
        }
    },

    /**
     * Delete a manpower recommendation by ID.
     * @param id - Recommendation record ID.
     */
    async remove(id: number): Promise<void> {
        try {
            const response = await fetch(`${API_BASE_URL}/items/manpower_recommendation/${id}`, {
                method: "DELETE",
                headers,
            });
            if (!response.ok) {
                const errorText = await response.text();
                console.error(`DIRECTUS ERROR [delete:${id}]:`, errorText);
                throw new Error(`HTTP error! status: ${response.status}`);
            }
        } catch (e) {
            console.error("Error deleting manpower recommendation:", e);
            throw new Error("INTERNAL_FAIL: Failed to delete manpower recommendation");
        }
    },

    /**
     * Fetch the status of a manpower request (Draft guard for create).
     * @param requestId - Manpower request record ID.
     * @returns The request status string.
     */
    async fetchRequestStatus(requestId: number): Promise<string> {
        try {
            const url = `${API_BASE_URL}/items/manpower_request/${requestId}?fields=status`;
            const response = await fetch(url, { headers });
            if (!response.ok) {
                const errorText = await response.text();
                console.error(`DIRECTUS ERROR [fetchRequestStatus:${requestId}]:`, errorText);
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const result = await response.json();
            return result.data.status as string;
        } catch (e) {
            console.error("Error fetching manpower request status:", e);
            throw new Error("INTERNAL_FAIL: Failed to fetch manpower request status");
        }
    },
};

/**
 * Cast a raw Directus row to a ManpowerRecommendation.
 * @param row - Raw Directus row.
 * @returns The normalized recommendation record.
 */
export function normalizeRecommendation(row: Record<string, unknown>): ManpowerRecommendation {
    return row as unknown as ManpowerRecommendation;
}
