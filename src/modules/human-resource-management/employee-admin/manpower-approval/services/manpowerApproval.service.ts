import type { ManpowerRequest } from "../types";

const getHeaders = () => {
    return {
        Authorization: `Bearer ${process.env.DIRECTUS_STATIC_TOKEN}`,
        "Content-Type": "application/json",
    };
};

export const manpowerApprovalService = {
    async fetchDraftRequests(): Promise<ManpowerRequest[]> {
        try {
            const url =
                `${process.env.NEXT_PUBLIC_API_BASE_URL}/items/manpower_request` +
                `?fields=*,requested_by.user_id,requested_by.user_fname,requested_by.user_lname` +
                `&filter[status][_eq]=Draft` +
                `&sort=-created_at`;

            const response = await fetch(url, { headers: getHeaders() });
            if (!response.ok) {
                const errorText = await response.text();
                console.error(`DIRECTUS ERROR [fetchDraftRequests]:`, errorText);
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const result = await response.json();
            
            if (result.data.length === 0) return [];
            return result.data;
        } catch (e) {
            console.error("Error fetching draft manpower requests:", e);
            throw new Error("INTERNAL_FAIL: Failed to fetch draft manpower requests");
        }
    },

    async fetchDepartments(): Promise<{id: number, name: string}[]> {
        try {
            const url = `${process.env.NEXT_PUBLIC_API_BASE_URL}/items/department?fields=department_id,department_name`;
            const response = await fetch(url, { headers: getHeaders() });
            if (!response.ok) return [];
            const result = await response.json();
            return result.data.map((d: { department_id: number; department_name: string }) => ({ id: d.department_id, name: d.department_name }));
        } catch { return []; }
    },

    async fetchDivisions(): Promise<{id: number, name: string}[]> {
        try {
            const url = `${process.env.NEXT_PUBLIC_API_BASE_URL}/items/division?fields=division_id,division_name`;
            const response = await fetch(url, { headers: getHeaders() });
            if (!response.ok) return [];
            const result = await response.json();
            return result.data.map((d: { division_id: number; division_name: string }) => ({ id: d.division_id, name: d.division_name }));
        } catch { return []; }
    },

    async fetchUsers(): Promise<{id: number | string, name: string}[]> {
        try {
            const url = `${process.env.NEXT_PUBLIC_API_BASE_URL}/items/user?fields=user_id,user_fname,user_lname&limit=-1`;
            const response = await fetch(url, { headers: getHeaders() });
            if (!response.ok) return [];
            const result = await response.json();
            return result.data.map((u: { user_id: number | string; user_fname?: string; user_lname?: string }) => ({ 
                id: u.user_id, 
                name: `${u.user_fname ?? ''} ${u.user_lname ?? ''}`.trim() || String(u.user_id)
            }));
        } catch { return []; }
    },

    async updateStatus(id: number, status: 'Approved' | 'Rejected', userId?: number): Promise<boolean> {
        try {
            const url = `${process.env.NEXT_PUBLIC_API_BASE_URL}/items/manpower_request/${id}`;
            const bodyData: Record<string, string | number> = { status };
            const now = new Date().toISOString();
            
            if (status === 'Approved') {
                if (userId) bodyData.approved_by = userId;
                bodyData.approved_at = now;
            } else if (status === 'Rejected') {
                if (userId) bodyData.rejected_by = userId;
                bodyData.rejected_at = now;
            }

            const response = await fetch(url, {
                method: "PATCH",
                headers: getHeaders(),
                body: JSON.stringify(bodyData)
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error(`DIRECTUS ERROR [updateStatus:${id}]:`, errorText);
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return true;
        } catch (e) {
            console.error("Error updating manpower request status:", e);
            throw new Error("INTERNAL_FAIL: Failed to update status");
        }
    }
};
