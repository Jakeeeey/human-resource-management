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
     * Returns a mapping of userId -> { subsystems: Set<string>, modules: Set<string> }.
     */
    static async getPermissionsForUsers(userIds: string[]): Promise<Record<string, { subsystemSlugs: string[], moduleSlugs: string[], subsystemAccessIds: Record<string, number>, moduleAccessIds: Record<string, number> }>> {
        if (!userIds.length) return {};
        try {
            const filter = encodeURIComponent(JSON.stringify({
                user_id: { _in: userIds }
            }));

            // Fetch from both tables in parallel
            const [subRes, modRes] = await Promise.all([
                fetch(`/api/hrm/user-access-subsystems?filter=${filter}&limit=-1&fields=id,user_id,subsystem_id.slug`),
                fetch(`/api/hrm/user-access-modules?filter=${filter}&limit=-1&fields=id,user_id,module_id.slug`)
            ]);

            const [subResult, modResult] = await Promise.all([subRes.json(), modRes.json()]);
            const subData = subResult.data || [];
            const modData = modResult.data || [];

            const mapping: Record<string, { subsystemSlugs: string[], moduleSlugs: string[], subsystemAccessIds: Record<string, number>, moduleAccessIds: Record<string, number> }> = {};

            // Process Subsystems
            subData.forEach((row: any) => {
                const uid = String(row.user_id);
                if (!mapping[uid]) mapping[uid] = { subsystemSlugs: [], moduleSlugs: [], subsystemAccessIds: {}, moduleAccessIds: {} };
                if (row.subsystem_id?.slug) {
                    mapping[uid].subsystemSlugs.push(row.subsystem_id.slug);
                    mapping[uid].subsystemAccessIds[row.subsystem_id.slug] = row.id;
                }
            });

            // Process Modules
            modData.forEach((row: any) => {
                const uid = String(row.user_id);
                if (!mapping[uid]) mapping[uid] = { subsystemSlugs: [], moduleSlugs: [], subsystemAccessIds: {}, moduleAccessIds: {} };
                if (row.module_id?.slug) {
                    mapping[uid].moduleSlugs.push(row.module_id.slug);
                    mapping[uid].moduleAccessIds[row.module_id.slug] = row.id;
                }
            });

            return mapping;
        } catch (error) {
            console.error("Error fetching bulk permissions:", error);
            return {};
        }
    }

    /**
     * Performs a Granular Update (Diff & Sync) for user permissions using IDs.
     */
    static async updatePermissions(
        userId: string, 
        currentAdminId: string | number | null,
        updates: {
            subsystemsToAdd: number[];   // IDs from registry
            subsystemsToRemove: number[]; // Junction Record IDs
            modulesToAdd: number[];      // IDs from registry
            modulesToRemove: number[];    // Junction Record IDs
        }
    ): Promise<boolean> {
        try {
            const promises = [];

            // 1. Subsystems
            if (updates.subsystemsToAdd.length > 0) {
                promises.push(fetch(`/api/hrm/user-access-subsystems`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(updates.subsystemsToAdd.map(id => ({ 
                        user_id: userId, 
                        subsystem_id: id,
                        ...(currentAdminId ? { created_by: currentAdminId } : {})
                    })))
                }));
            }
            if (updates.subsystemsToRemove.length > 0) {
                promises.push(fetch(`/api/hrm/user-access-subsystems`, {
                    method: "DELETE",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(updates.subsystemsToRemove)
                }));
            }

            // 2. Modules
            if (updates.modulesToAdd.length > 0) {
                promises.push(fetch(`/api/hrm/user-access-modules`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(updates.modulesToAdd.map(id => ({ 
                        user_id: userId, 
                        module_id: id,
                        ...(currentAdminId ? { created_by: currentAdminId } : {})
                    })))
                }));
            }
            if (updates.modulesToRemove.length > 0) {
                promises.push(fetch(`/api/hrm/user-access-modules`, {
                    method: "DELETE",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(updates.modulesToRemove)
                }));
            }

            if (promises.length === 0) return true;

            const results = await Promise.all(promises);
            return results.every(r => r.ok);
        } catch (error) {
            console.error("Error in updatePermissions:", error);
            return false;
        }
    }
}
