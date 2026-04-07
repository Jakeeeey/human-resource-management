import { create } from 'zustand';
import { ModuleRegistration } from '@/modules/human-resource-management/subsystem-registration/types';

interface NavigationState {
    modules: ModuleRegistration[];
    isLoading: boolean;
    hasFetched: boolean;
    fetchModules: (force?: boolean) => Promise<void>;
}

export const useNavigationStore = create<NavigationState>((set, get) => ({
    modules: [],
    isLoading: false,
    hasFetched: false,
    fetchModules: async (force = false) => {
        if (get().hasFetched && !force) return;
        set({ isLoading: true });
        try {
            // Fetch modules for HRM subsystem (slug: hrm)
            const res = await fetch(`/api/hrm/modules?filter={"subsystem_id":{"slug":{"_eq":"hrm"}}}&sort=sort&limit=-1`);
            if (res.ok) {
                const { data: allModules } = await res.json();
                
                // Build recursive tree
                const modulesById: Record<string, ModuleRegistration> = {};
                const roots: ModuleRegistration[] = [];

                // 1. Initialize map and handle potential numeric IDs from DB
                (allModules || []).forEach((m: any) => {
                    const mod: ModuleRegistration = {
                        ...m,
                        id: String(m.id),
                        subModules: []
                    };
                    modulesById[mod.id] = mod;
                });

                // 2. Link children to parents
                (allModules || []).forEach((m: any) => {
                    const id = String(m.id);
                    const parentId = m.parent_module_id ? String(m.parent_module_id) : null;
                    
                    if (parentId && modulesById[parentId]) {
                        modulesById[parentId].subModules?.push(modulesById[id]);
                    } else if (!parentId) {
                        roots.push(modulesById[id]);
                    }
                });

                set({ modules: roots, hasFetched: true });
            }
        } catch (err) {
            console.error("Failed to fetch navigation modules:", err);
        } finally {
            set({ isLoading: false });
        }
    }
}));
