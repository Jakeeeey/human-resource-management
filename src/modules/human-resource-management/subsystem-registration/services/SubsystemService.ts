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
                fetch(`/api/hrm/subsystem-registration/subsystems?limit=-1`),
                fetch(`/api/hrm/subsystem-registration/modules?limit=-1&sort=sort`)
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

    private static collectIds(modules: ModuleRegistration[]): number[] {
        const ids: number[] = [];
        const traverse = (items: ModuleRegistration[]) => {
            items.forEach(item => {
                const id = Number(item.id);
                if (!isNaN(id)) ids.push(id);
                if (item.subModules) traverse(item.subModules);
            });
        };
        traverse(modules);
        return ids;
    }

    private static async syncModulesRecursively(
        modules: ModuleRegistration[], 
        subsystemId: number, 
        parentId: number | null = null
    ): Promise<void> {
        // Flatten the current tree level to prepare for bulk/parallel sync
        const itemsToUpdate: { id: string | number; payload: Partial<ModuleRegistration>; _original: ModuleRegistration }[] = [];
        const itemsToCreate: { payload: Partial<ModuleRegistration>; _original: ModuleRegistration }[] = [];
        const childrenToSync: { modules: ModuleRegistration[], parentId: number | null }[] = [];

        modules.forEach((itemModule, index) => {
            const isNew = !itemModule.id || isNaN(Number(itemModule.id)) || String(itemModule.id).length > 5;
            
            const payload = {
                slug: itemModule.slug || "",
                title: itemModule.title || "Untitled",
                base_path: itemModule.base_path || "",
                status: itemModule.status || "active",
                icon_name: itemModule.icon_name || "Folder",
                sort: index,
                subsystem_id: subsystemId,
                parent_module_id: parentId
            };

            if (isNew) {
                itemsToCreate.push({ payload, _original: itemModule });
            } else {
                itemsToUpdate.push({ id: itemModule.id, payload, _original: itemModule });
            }
        });

        // 1. Bulk Update existing items in parallel
        if (itemsToUpdate.length > 0) {
            await Promise.all(itemsToUpdate.map(async (item) => {
                return fetch(`/api/hrm/subsystem-registration/modules?id=${item.id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(item.payload)
                });
            }));
            
            // Queue children of updated items
            itemsToUpdate.forEach(item => {
                if (item._original.subModules?.length) {
                    childrenToSync.push({ 
                        modules: item._original.subModules, 
                        parentId: Number(item.id) 
                    });
                }
            });
        }

        // 2. Process New Items (Parallel for current level, IDs passed to next)
        if (itemsToCreate.length > 0) {
            await Promise.all(itemsToCreate.map(async (item) => {
                const response = await fetch(`/api/hrm/subsystem-registration/modules`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(item.payload)
                });
                
                if (response.ok) {
                    const { data } = await response.json();
                    if (item._original.subModules?.length) {
                        childrenToSync.push({ 
                            modules: item._original.subModules, 
                            parentId: Number(data.id) 
                        });
                    }
                }
            }));
        }

        // 3. Process all children tiers in parallel
        if (childrenToSync.length > 0) {
            await Promise.all(childrenToSync.map(group => 
                this.syncModulesRecursively(group.modules, subsystemId, group.parentId)
            ));
        }
    }

    static async createSubsystem(data: Partial<SubsystemRegistration>): Promise<SubsystemRegistration | null> {
        try {
            const cleanedData = { ...data };
            delete cleanedData.id;
            delete cleanedData.modules;

            const response = await fetch(`/api/hrm/subsystem-registration/subsystems`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(cleanedData)
            });
            
            if (!response.ok) return null;
            const { data: created } = await response.json();
            
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
            delete subsystemPayload.modules;

            // 1. Update the subsystem record
            const response = await fetch(`/api/hrm/subsystem-registration/subsystems?id=${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(subsystemPayload)
            });

            if (data.modules) {
                // 2. PRUNING: Bulk Delete stale modules in parallel
                try {
                    const currentRes = await fetch(`/api/hrm/subsystem-registration/modules?filter={"subsystem_id":{"_eq":${subsystemId}}}&fields=id`);
                    if (currentRes.ok) {
                        const { data: currentInDb } = await currentRes.json();
                        const dbIds = (currentInDb || []).map((m: { id: string | number }) => Number(m.id));
                        const incomingIds = this.collectIds(data.modules);
                        const staleIds = dbIds.filter((dbId: number) => !incomingIds.includes(dbId));
                        
                        // Bulk Parallel Delete
                        await Promise.all(staleIds.map((sId: number) => 
                            fetch(`/api/hrm/subsystem-registration/modules?id=${sId}`, { method: "DELETE" })
                        ));
                    }
                } catch (pruneErr) {
                    console.error("Pruning failed:", pruneErr);
                }

                // 3. Batch Sync Current Hierarchy
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
            const response = await fetch(`/api/hrm/subsystem-registration/subsystems?id=${id}`, {
                method: "DELETE"
            });
            return response.ok;
        } catch (error) {
            console.error("Error deleting subsystem:", error);
            return false;
        }
    }

    /** @deprecated */
    static async saveSubsystems(): Promise<void> {
        console.warn("saveSubsystems is slow and deprecated.");
    }
}
