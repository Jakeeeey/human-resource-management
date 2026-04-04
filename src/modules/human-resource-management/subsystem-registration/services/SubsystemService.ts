import { SubsystemRegistration, ModuleRegistration } from "../types";

interface RawModule extends ModuleRegistration {
    subsystem_id?: number;
    parent_module_id?: number | null;
}

export class SubsystemService {
    static async getSubsystems(): Promise<SubsystemRegistration[]> {
        try {
            // Fetch everything in parallel for speed
            const [subRes, modRes] = await Promise.all([
                fetch(`/api/hrm/subsystems?limit=-1`),
                fetch(`/api/hrm/modules?limit=-1`)
            ]);

            if (!subRes.ok || !modRes.ok) return [];

            const { data: subsystems } = await subRes.json();
            const { data: allModules } = await modRes.json();

            // 1. Build a map of modules by their subsystem_id
            const modulesBySubsystem: Record<number, RawModule[]> = {};
            const modulesById: Record<number, RawModule> = {};

            (allModules || []).forEach((m: RawModule) => {
                const mod: RawModule = { ...m, subModules: [] };
                modulesById[Number(mod.id)] = mod;
                
                const sid = Number(m.subsystem_id);
                if (!modulesBySubsystem[sid]) modulesBySubsystem[sid] = [];
                modulesBySubsystem[sid].push(mod);
            });

            // 2. Build the recursive tree for each subsystem
            const finalSubsystems = (subsystems || []).map((sub: SubsystemRegistration) => {
                const subId = Number(sub.id);
                const subModules = modulesBySubsystem[subId] || [];
                
                // Identify root modules (those with no parent_module_id)
                const roots = subModules.filter(m => !m.parent_module_id);
                
                // Link children to parents
                subModules.forEach(m => {
                    const parentId = m.parent_module_id ? Number(m.parent_module_id) : null;
                    if (parentId && modulesById[parentId]) {
                        if (!modulesById[parentId].subModules) modulesById[parentId].subModules = [];
                        modulesById[parentId].subModules?.push(m);
                    }
                });

                return {
                    ...sub,
                    modules: roots
                };
            });

            return finalSubsystems;
        } catch (error) {
            console.error("Error in manual getSubsystems:", error);
            return [];
        }
    }

    /**
     * Recursively syncs modules and sub-modules to the database.
     * Handles both new items (POST) and updates (PATCH).
     */
    private static async syncModulesRecursively(
        modules: ModuleRegistration[], 
        subsystemId: number, 
        parentId: number | null = null
    ): Promise<void> {
        for (const itemModule of modules) {
            const isNew = !itemModule.id || isNaN(Number(itemModule.id)) || String(itemModule.id).length > 5;
            
            // Prepare payload
            const payload = {
                slug: itemModule.slug || "",
                title: itemModule.title || "Untitled",
                base_path: itemModule.base_path || "",
                status: itemModule.status || "active",
                icon_name: itemModule.icon_name || "Folder",
                subsystem_id: subsystemId,
                parent_module_id: parentId
            };

            let savedModuleId: string | number = itemModule.id;

            try {
                if (isNew) {
                    // Create new module
                    const response = await fetch(`/api/hrm/modules`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(payload)
                    });
                    if (response.ok) {
                        const { data } = await response.json();
                        savedModuleId = data.id;
                    }
                } else {
                    // Update existing module
                    await fetch(`/api/hrm/modules?id=${module.id}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(payload)
                    });
                }

                // Recursively sync sub-modules if any
                if (itemModule.subModules && itemModule.subModules.length > 0 && savedModuleId) {
                    await this.syncModulesRecursively(itemModule.subModules, subsystemId, Number(savedModuleId));
                }
            } catch (err) {
                console.error(`Failed to sync module: ${itemModule.title}`, err);
            }
        }
    }

    static async createSubsystem(data: Partial<SubsystemRegistration>): Promise<SubsystemRegistration | null> {
        try {
            // New subsystems shouldn't have ID yet
            const cleanedData = { ...data };
            delete cleanedData.id;
            delete cleanedData.modules; // Modules saved via sync

            const response = await fetch(`/api/hrm/subsystems`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(cleanedData)
            });
            
            if (!response.ok) return null;
            
            const { data: created } = await response.json();
            
            // Sync modules if any were provided
            if (data.modules && data.modules.length > 0) {
                await this.syncModulesRecursively(data.modules, Number(created.id));
            }

            return created;
        } catch (error) {
            console.error("Error creating subsystem:", error);
            return null;
        }
    }

    static async updateSubsystem(id: string, data: Partial<SubsystemRegistration>): Promise<boolean> {
        try {
            const subsystemId = Number(id);
            const subsystemPayload = { ...data };
            delete subsystemPayload.modules; // Modules saved via explicit sync

            // 1. Update the subsystem record
            const response = await fetch(`/api/hrm/subsystems?id=${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(subsystemPayload)
            });

            // 2. Sync Hierarchy (Modules and Sub-modules)
            if (data.modules) {
                await this.syncModulesRecursively(data.modules, subsystemId);
            }

            return response.ok;
        } catch (error) {
            console.error("Error updating subsystem:", error);
            return false;
        }
    }

    static async deleteSubsystem(id: string): Promise<boolean> {
        try {
            const response = await fetch(`/api/hrm/subsystems?id=${id}`, {
                method: "DELETE"
            });
            return response.ok;
        } catch (error) {
            console.error("Error deleting subsystem:", error);
            return false;
        }
    }

    /** @deprecated Use createSubsystem, updateSubsystem, or deleteSubsystem instead */
    static async saveSubsystems(): Promise<void> {
        console.warn("saveSubsystems is slow and deprecated. System is migrating to granular CRUD.");
    }
}
