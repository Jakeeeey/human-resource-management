import { UserSubsystemAccess } from "../types";

export class UserService {
    /**
     * Fetches real users from the system.
     * Maps to UserSubsystemAccess type.
     */
    static async getUsers(limit = 50, offset = 0): Promise<{ users: UserSubsystemAccess[], total: number }> {
        let users: UserSubsystemAccess[] = [];
        let total = 0;
        try {
            // Fetch from our local proxy route with pagination params
            const response = await fetch(`/api/hrm/user-configuration?limit=${limit}&offset=${offset}`);
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                console.error("Failed to fetch users from /api/hrm/user-configuration:", {
                    status: response.status,
                    details: errorData
                });
                return { users: [], total: 0 };
            }
            
            const result = await response.json();
            const data = result.data || result;
            total = result.meta?.filter_count || 0;

            users = (data || []).map((user: {
                user_id?: string;
                user_email?: string;
                user_fname?: string;
                user_mname?: string;
                user_lname?: string;
                user_image?: string;
            }) => ({
                user_id: String(user.user_id || ""),
                email: user.user_email || "No Email",
                full_name: `${user.user_fname || ""} ${user.user_mname ? user.user_mname + " " : ""}${user.user_lname || ""}`.trim() || "Unknown User",
                avatar_url: user.user_image || null,
                authorized_subsystems: [], // To be populated by bulk fetch
            }));

            return { users, total };
        } catch (error) {
            console.error("Error fetching users:", error);
            return { users, total };
        }
    }

    /**
    /**
     * Fetches permissions for a list of users in bulk.
     * Returns a mapping of userId -> { slug: string, id: string | number }[].
     */
    static async getPermissionsForUsers(userIds: string[]): Promise<Record<string, { slug: string, id: string | number }[]>> {
        if (!userIds.length) return {};
        try {
            const filter = encodeURIComponent(JSON.stringify({
                user_id: { _in: userIds }
            }));
            const url = `/api/hrm/user-access?filter=${filter}&limit=-1&fields=id,user_id,item_slug`;
            const response = await fetch(url);
            
            if (!response.ok) return {};

            const { data } = await response.json();
            const mapping: Record<string, { slug: string, id: string | number }[]> = {};
            
            (data || []).forEach((row: { id: string | number; user_id: string | number; item_slug: string }) => {
                const uid = String(row.user_id);
                if (!mapping[uid]) mapping[uid] = [];
                mapping[uid].push({ slug: row.item_slug, id: row.id });
            });

            return mapping;
        } catch (error) {
            console.error("Error fetching bulk permissions:", error);
            return {};
        }
    }

    /**
     * Performs a Granular Update (Diff & Sync) for user permissions.
     */
    static async updatePermissions(userId: string, newSlugs: string[]): Promise<boolean> {
        try {
            // 1. Fetch current permissions for diffing
            const existingMapping = await this.getPermissionsForUsers([userId]);
            const currentRecords = existingMapping[userId] || [];
            const currentSlugs = currentRecords.map(r => r.slug);

            // 2. Calculate Diff
            const toAdd = newSlugs.filter(s => !currentSlugs.includes(s));
            const toRemoveSlugs = currentSlugs.filter(s => !newSlugs.includes(s));
            
            // Get the record IDs for the slugs to remove
            const idsToRemove = currentRecords
                .filter(r => toRemoveSlugs.includes(r.slug))
                .map(r => r.id);

            // If no changes, return success
            if (toAdd.length === 0 && idsToRemove.length === 0) return true;

            // 3. Execute Granular Changes
            const promises = [];

            // Add new permissions
            if (toAdd.length > 0) {
                promises.push(fetch(`/api/hrm/user-access`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(toAdd.map(slug => ({ user_id: userId, item_slug: slug })))
                }));
            }

            // Remove revoked permissions using Bulk Delete by ID
            if (idsToRemove.length > 0) {
                promises.push(fetch(`/api/hrm/user-access`, {
                    method: "DELETE",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(idsToRemove)
                }));
            }

            const results = await Promise.all(promises);
            const allSuccess = results.every(r => r.ok);

            if (!allSuccess) {
                const errorResults = results.filter(r => !r.ok);
                for (const res of errorResults) {
                    const errText = await res.text();
                    console.error(`[UserService] Permission sync failed (${res.status}):`, errText);
                }
            }

            return allSuccess;
        } catch (error) {
            console.error("Error in granular updatePermissions:", error);
            return false;
        }
    }
}
