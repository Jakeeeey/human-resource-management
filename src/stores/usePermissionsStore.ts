import { create } from 'zustand';

interface PermissionsState {
    userId: string | null;
    permissions: string[];
    subsystemIds: number[];
    moduleIds: number[];
    isAdmin: boolean;
    isLoading: boolean;
    hasFetched: boolean;
    fetchPermissions: () => Promise<void>;
    updatePermissionsRemotely: (newPermissions: string[], subsystemIds?: number[], moduleIds?: number[], isAdmin?: boolean) => void;
}

export const usePermissionsStore = create<PermissionsState>((set, get) => ({
    userId: null,
    permissions: [],
    subsystemIds: [],
    moduleIds: [],
    isAdmin: false,
    isLoading: true,
    hasFetched: false,
    fetchPermissions: async () => {
        if (get().hasFetched) return;
        set({ isLoading: true });
        try {
            const res = await fetch("/api/hrm/user-profile");
            if (res.ok) {
                const result = await res.json();
                set({ 
                    permissions: result.permissions || [],
                    subsystemIds: result.subsystemIds || [],
                    moduleIds: result.moduleIds || [],
                    isAdmin: !!result.isAdmin,
                    userId: result.userId,
                    hasFetched: true 
                });
            }
        } catch (err) {
            console.error("Failed to fetch permissions:", err);
        } finally {
            set({ isLoading: false });
        }
    },
    updatePermissionsRemotely: (newPermissions: string[], newSubIds: number[] = [], newModIds: number[] = [], isAdmin: boolean = false) => {
        set({ permissions: newPermissions, subsystemIds: newSubIds, moduleIds: newModIds, isAdmin });
    }
}));
