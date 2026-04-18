import { UserSubsystemAccess } from "../types";
import { SubsystemRegistration, ModuleRegistration } from "@/modules/human-resource-management/subsystem-registration/types";

interface RawModule extends ModuleRegistration {
    subsystem_id?: number;
    parent_module_id?: number | null;
}

export class UserService {
    private static cachedSubsystems: SubsystemRegistration[] | null = null;

    /**
     * Fetches real users from the system.
     * Maps to UserSubsystemAccess type.
     */
    static async getUsers(limit = 50, offset = 0, search = ""): Promise<{ users: UserSubsystemAccess[], total: number }> {
        let users: UserSubsystemAccess[] = [];
        let total = 0;
        try {
            // Fetch from our local proxy route with pagination params
            const searchParam = search ? `&search=${encodeURIComponent(search)}` : "";
            const response = await fetch(`/api/hrm/user-configuration/users?limit=${limit}&offset=${offset}${searchParam}`);
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                console.error("Failed to fetch users from /api/hrm/user-configuration/users:", {
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
            }) => ({
                user_id: String(user.user_id || ""),
                email: user.user_email || "No Email",
                full_name: `${user.user_fname || ""} ${user.user_mname ? user.user_mname + " " : ""}${user.user_lname || ""}`.trim() || "Unknown User",
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
    static async getPermissionsForUsers(userIds: string[]): Promise<Record<string, { subsystemSlugs: string[], moduleSlugs: string[], subsystemIds: number[], moduleIds: number[], subsystemAccessIds: Record<number, number>, moduleAccessIds: Record<number, number> }>> {
        if (!userIds.length) return {};
        try {
            const filter = encodeURIComponent(JSON.stringify({
                user_id: { _in: userIds }
            }));

            // Fetch from both tables in parallel
            const [subRes, modRes] = await Promise.all([
                fetch(`/api/hrm/user-configuration/user-access-subsystems?filter=${filter}&limit=-1&fields=id,user_id,subsystem_id.slug,subsystem_id.id`),
                fetch(`/api/hrm/user-configuration/user-access-modules?filter=${filter}&limit=-1&fields=id,user_id,module_id.slug,module_id.id`)
            ]);

            const [subResult, modResult] = await Promise.all([subRes.json(), modRes.json()]);
            const subData = subResult.data || [];
            const modData = modResult.data || [];

            const mapping: Record<string, { subsystemSlugs: string[], moduleSlugs: string[], subsystemIds: number[], moduleIds: number[], subsystemAccessIds: Record<number, number>, moduleAccessIds: Record<number, number> }> = {};

            // Process Subsystems
            subData.forEach((row: { id: number, user_id: string | number, subsystem_id?: { slug?: string, id?: number } }) => {
                const uid = String(row.user_id);
                if (!mapping[uid]) mapping[uid] = { subsystemSlugs: [], moduleSlugs: [], subsystemIds: [], moduleIds: [], subsystemAccessIds: {}, moduleAccessIds: {} };
                if (row.subsystem_id?.slug) {
                    mapping[uid].subsystemSlugs.push(row.subsystem_id.slug);
                    if (row.subsystem_id.id) {
                        const sid = Number(row.subsystem_id.id);
                        mapping[uid].subsystemIds.push(sid);
                        mapping[uid].subsystemAccessIds[sid] = row.id;
                    }
                }
            });

            // Process Modules
            modData.forEach((row: { id: number, user_id: string | number, module_id?: { slug?: string, id?: number } }) => {
                const uid = String(row.user_id);
                if (!mapping[uid]) mapping[uid] = { subsystemSlugs: [], moduleSlugs: [], subsystemIds: [], moduleIds: [], subsystemAccessIds: {}, moduleAccessIds: {} };
                if (row.module_id?.slug) {
                    const slug = row.module_id.slug;
                    mapping[uid].moduleSlugs.push(slug);
                    
                    if (row.module_id.id) {
                        const mid = Number(row.module_id.id);
                        mapping[uid].moduleIds.push(mid);
                        mapping[uid].moduleAccessIds[mid] = row.id;
                    }
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
                promises.push(fetch(`/api/hrm/user-configuration/user-access-subsystems`, {
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
                promises.push(fetch(`/api/hrm/user-configuration/user-access-subsystems`, {
                    method: "DELETE",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(updates.subsystemsToRemove)
                }));
            }

            // 2. Modules
            if (updates.modulesToAdd.length > 0) {
                promises.push(fetch(`/api/hrm/user-configuration/user-access-modules`, {
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
                promises.push(fetch(`/api/hrm/user-configuration/user-access-modules`, {
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

    static async getSubsystemsRegistry(): Promise<SubsystemRegistration[]> {
        if (this.cachedSubsystems) return this.cachedSubsystems;

        try {
            // Fetch subsystems and all modules in parallel for User Configuration registry
            const [subsystemsRes, modulesRes] = await Promise.all([
                fetch(`/api/hrm/user-configuration/subsystems`),
                fetch(`/api/hrm/user-configuration/modules`)
            ]);

            if (!subsystemsRes.ok || !modulesRes.ok) return [];

            const { data: subsystems } = await subsystemsRes.json();
            const { data: allModules } = await modulesRes.json();

            // 1. Build a map of modules by their subsystem_id
            const modulesBySubsystem: Record<number, RawModule[]> = {};
            const modulesById: Record<number, RawModule> = {};

            (allModules || []).forEach((m: RawModule) => {
                const mod: RawModule = { ...m, id: Number(m.id), subModules: [] };
                modulesById[Number(mod.id)] = mod;
                
                const sid = Number(m.subsystem_id);
                if (!modulesBySubsystem[sid]) modulesBySubsystem[sid] = [];
                modulesBySubsystem[sid].push(mod);
            });

            // 2. Build the recursive tree for each subsystem
            const finalSubsystems = (subsystems || []).map((sub: SubsystemRegistration) => {
                const subId = Number(sub.id);
                const subModulesForThisSub = modulesBySubsystem[subId] || [];
                
                // Identify root modules for this subsystem
                const roots = subModulesForThisSub.filter(m => !m.parent_module_id);
                
                // Link children to parents within this subsystem's modules
                subModulesForThisSub.forEach(m => {
                    const parentId = m.parent_module_id ? Number(m.parent_module_id) : null;
                    if (parentId && modulesById[parentId]) {
                        if (!modulesById[parentId].subModules) modulesById[parentId].subModules = [];
                        
                        // Prevent duplicates
                        const alreadyExists = modulesById[parentId].subModules?.some(child => child.id === m.id);
                        if (!alreadyExists) {
                            modulesById[parentId].subModules?.push(m);
                        }
                    }
                });

                return {
                    ...sub,
                    id: subId,
                    modules: roots
                } as SubsystemRegistration;
            });

            this.cachedSubsystems = finalSubsystems;
            return finalSubsystems;
        } catch (error) {
            console.error("Error fetching subsystems registry for User Config:", error);
            return [];
        }
    }
}
