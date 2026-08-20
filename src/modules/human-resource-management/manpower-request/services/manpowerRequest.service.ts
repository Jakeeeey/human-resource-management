import { ManpowerRequest } from "../types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
const STATIC_TOKEN = process.env.DIRECTUS_STATIC_TOKEN;

const headers = {
    Authorization: `Bearer ${STATIC_TOKEN}`,
    "Content-Type": "application/json",
};

export const manpowerRequestService = {
    async fetchAll(): Promise<ManpowerRequest[]> {
        try {
            const url =
                `${API_BASE_URL}/items/manpower_request` +
                `?fields=*,requested_by.user_id,requested_by.user_fname,requested_by.user_lname` +
                `&sort=-created_at`;

            const response = await fetch(url, { headers });
            if (!response.ok) {
                const errorText = await response.text();
                console.error(`DIRECTUS ERROR [fetchAll]:`, errorText);
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const result = await response.json();
            const rows: Record<string, unknown>[] = result.data;
            
            if (rows.length === 0) return [];
            return rows.map(normalizeManpowerRequest);
        } catch (e) {
            console.error("Error fetching manpower requests:", e);
            throw new Error("INTERNAL_FAIL: Failed to fetch manpower requests");
        }
    },

    async fetchById(id: number): Promise<ManpowerRequest | null> {
        try {
            const url =
                `${API_BASE_URL}/items/manpower_request/${id}` +
                `?fields=*,requested_by.user_id,requested_by.user_fname,requested_by.user_lname`;

            const response = await fetch(url, { headers });
            if (response.status === 404) return null;
            if (!response.ok) {
                const errorText = await response.text();
                console.error(`DIRECTUS ERROR [fetchById:${id}]:`, errorText);
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const result = await response.json();
            return normalizeManpowerRequest(result.data);
        } catch (e) {
            console.error("Error fetching manpower request:", e);
            throw new Error("INTERNAL_FAIL: Failed to fetch manpower request");
        }
    },

    async fetchDepartments(): Promise<{id: number, name: string}[]> {
        try {
            const url = `${API_BASE_URL}/items/department?fields=department_id,department_name`;
            const response = await fetch(url, { headers });
            if (!response.ok) return [];
            const result = await response.json();
            return result.data.map((d: { department_id: number; department_name: string }) => ({ id: d.department_id, name: d.department_name }));
        } catch { return []; }
    },

    async fetchDivisions(): Promise<{id: number, name: string}[]> {
        try {
            const url = `${API_BASE_URL}/items/division?fields=division_id,division_name`;
            const response = await fetch(url, { headers });
            if (!response.ok) return [];
            const result = await response.json();
            return result.data.map((d: { division_id: number; division_name: string }) => ({ id: d.division_id, name: d.division_name }));
        } catch { return []; }
    },

    async create(request: ManpowerRequest): Promise<ManpowerRequest> {
        try {
            const body = { ...request };
            
            const response = await fetch(`${API_BASE_URL}/items/manpower_request`, {
                method: "POST",
                headers,
                body: JSON.stringify(body),
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`DIRECTUS ERROR [create request]:`, errorText);
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const result = await response.json();
            return normalizeManpowerRequest(result.data);
        } catch (e) {
            console.error("Error creating manpower request:", e);
            throw new Error("VALIDATION_FAILED: Failed to submit manpower request");
        }
    },

    async update(id: number, data: Partial<ManpowerRequest>): Promise<ManpowerRequest> {
        try {
            const response = await fetch(`${API_BASE_URL}/items/manpower_request/${id}`, {
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
            return normalizeManpowerRequest(result.data);
        } catch (e) {
            console.error("Error updating manpower request:", e);
            throw new Error("VALIDATION_FAILED: Failed to update manpower request");
        }
    },

    async remove(id: number): Promise<void> {
        try {
            const response = await fetch(`${API_BASE_URL}/items/manpower_request/${id}`, {
                method: "DELETE",
                headers,
            });
            if (!response.ok) {
                const errorText = await response.text();
                console.error(`DIRECTUS ERROR [delete:${id}]:`, errorText);
                throw new Error(`HTTP error! status: ${response.status}`);
            }
        } catch (e) {
            console.error("Error deleting manpower request:", e);
            throw new Error("INTERNAL_FAIL: Failed to delete manpower request");
        }
    },
};

function normalizeManpowerRequest(row: Record<string, unknown>): ManpowerRequest {
    // Normalization logic based on schema
    return row as unknown as ManpowerRequest;
}
