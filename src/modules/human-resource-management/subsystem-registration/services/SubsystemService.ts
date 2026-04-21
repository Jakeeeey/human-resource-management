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
    ): Promise<true | string> {
        // Optimized: Trigger all sibling modules in parallel
        const results = await Promise.all(modules.map(async (itemModule, index) => {
            const isNew = !itemModule.id || isNaN(Number(itemModule.id)) || String(itemModule.id).length > 10;
            
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

            let savedModuleId: string | number = itemModule.id;
            let currentError = "";

            try {
                if (isNew) {
                    // Create new module
                    const response = await fetch(`/api/hrm/subsystem-registration/modules`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(payload)
                    });
                    if (response.ok) {
                        const { data } = await response.json();
                        savedModuleId = data.id;
                    } else {
                        const errorData = await response.json();
                        // Extract Directus error if available
                        currentError = errorData.details?.errors?.[0]?.message || `Failed to create module "${itemModule.title}"`;
                        return currentError;
                    }
                } else {
                    // Update existing module
                    const response = await fetch(`/api/hrm/subsystem-registration/modules?id=${itemModule.id}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(payload)
                    });
                    if (!response.ok) {
                        // Fallback: Try with path parameter if query parameter failed
                        const secondaryResponse = await fetch(`/api/hrm/subsystem-registration/modules/${itemModule.id}`, {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify(payload)
                        });
                        if (!secondaryResponse.ok) {
                             const errorData = await secondaryResponse.json();
                             currentError = errorData.details?.errors?.[0]?.message || `Failed to update module "${itemModule.title}"`;
                             return currentError;
                        }
                    }
                }

                // Recursively sync sub-modules if any
                if (itemModule.subModules && itemModule.subModules.length > 0 && savedModuleId) {
                    const childrenResult = await this.syncModulesRecursively(itemModule.subModules, subsystemId, Number(savedModuleId));
                    if (childrenResult !== true) return childrenResult;
                }

                return true;
            } catch (err) {
                console.error(`Failed to sync module: ${itemModule.title}`, err);
                return `Connection error syncing "${itemModule.title}"`;
            }
        }));

        const errors: string[] = [];
        results.forEach((res, index) => {
            if (res !== true) {
                errors.push(typeof res === 'string' ? res : `Module "${modules[index].title}" failed to sync.`);
            }
        });

        return errors.length > 0 ? errors.join(" | ") : true;
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

    static async updateSubsystem(id: string, data: Partial<SubsystemRegistration>): Promise<{ success: boolean; message?: string }> {
        try {
            const subsystemId = Number(id);
            const subsystemPayload = { ...data };
            delete subsystemPayload.modules;

            // 1. Fetch current metadata to detect path changes
            const currentSubRes = await fetch(`/api/hrm/subsystem-registration/subsystems?id=${id}&fields=base_path`);
            let oldBasePath = "";
            if (currentSubRes.ok) {
                const { data: currentSub } = await currentSubRes.json();
                oldBasePath = currentSub?.base_path || "";
            }

            // 2. Update the subsystem record
            const response = await fetch(`/api/hrm/subsystem-registration/subsystems?id=${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(subsystemPayload)
            });

            if (!response.ok) {
                return { success: false, message: "Failed to update subsystem metadata." };
            }

            const newBasePath = data.base_path || oldBasePath;

            // 3. FORCE PATH ALIGNMENT: Ensure all modules match the current subsystem base_path
            if (newBasePath) {
                // Helper to fix prefix (e.g., transform "/er/apps" to "/ersft/apps" if root is "/ersft")
                const alignPath = (path: string, root: string): string => {
                    if (!path) return root;
                    if (path.startsWith(root)) return path;
                    
                    // Extract the sub-path after the first segment
                    // e.g. "/er/application/overtime" -> parts: ["er", "application", "overtime"]
                    const parts = path.split('/').filter(Boolean);
                    if (parts.length <= 1) return root; // It was just a root path like "/er"
                    
                    const subPath = parts.slice(1).join('/');
                    return root + (subPath ? '/' + subPath : '');
                };

                // Helper to transform the incoming tree in memory
                const transformTree = (items: ModuleRegistration[]) => {
                    items.forEach(m => {
                        if (m.base_path) {
                            m.base_path = alignPath(m.base_path, newBasePath);
                        }
                        if (m.subModules) transformTree(m.subModules);
                    });
                };

                try {
                    // Step A: Transform the incoming modules from the UI state
                    if (data.modules) transformTree(data.modules);

                    // Step B: Fetch all existing modules in DB and enforce the correct prefix
                    const modRes = await fetch(`/api/hrm/subsystem-registration/modules?filter={"subsystem_id":{"_eq":${subsystemId}}}&limit=-1`);
                    if (modRes.ok) {
                        const { data: allModules } = await modRes.json();
                        if (allModules && allModules.length > 0) {
                            await Promise.all(allModules.map(async (mod: RawModule) => {
                                const alignedPath = alignPath(mod.base_path || "", newBasePath);
                                if (mod.base_path !== alignedPath) {
                                    await fetch(`/api/hrm/subsystem-registration/modules?id=${mod.id}`, {
                                        method: "PATCH",
                                        headers: { "Content-Type": "application/json" },
                                        body: JSON.stringify({ base_path: alignedPath })
                                    });
                                }
                            }));
                        }
                    }
                } catch (propError) {
                    console.error("Forced path alignment failed:", propError);
                }
            }

            if (data.modules) {
                // 4. PRUNING: Bulk Delete stale modules in parallel
                try {
                    // FIX: Added limit=-1 to ensure all modules are fetched for pruning comparison
                    const currentRes = await fetch(`/api/hrm/subsystem-registration/modules?filter={"subsystem_id":{"_eq":${subsystemId}}}&fields=id&limit=-1`);
                    if (currentRes.ok) {
                        const { data: currentInDb } = await currentRes.json();
                        const dbIds = (currentInDb || []).map((m: { id: string | number }) => Number(m.id));
                        const incomingIds = this.collectIds(data.modules);
                        const staleIds = dbIds.filter((dbId: number) => !incomingIds.includes(dbId));
                        
                        if (staleIds.length > 0) {
                            const deleteRes = await fetch(`/api/hrm/subsystem-registration/modules`, { 
                                method: "DELETE",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify(staleIds)
                            });
                            
                            if (!deleteRes.ok) {
                                console.error("Bulk delete failed during pruning:", await deleteRes.text());
                                return { success: false, message: "Hierarchy cleanup failed. Some modules could not be removed." };
                            }
                        }
                    }
                } catch (pruneErr) {
                    console.error("Pruning failed:", pruneErr);
                    return { success: false, message: "Sync aborted: Could not verify existing structure." };
                }

                // 3. Batch Sync Current Hierarchy
                const modulesResult = await this.syncModulesRecursively(data.modules, subsystemId);
                if (modulesResult !== true) {
                    return { success: false, message: modulesResult };
                }
            }

            return { success: true };
        } catch (error) {
            console.error("Error updating subsystem:", error);
            return { success: false, message: error instanceof Error ? error.message : "Unknown error occurred" };
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
