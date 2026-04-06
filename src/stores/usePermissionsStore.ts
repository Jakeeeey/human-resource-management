import { create } from 'zustand';

interface PermissionsState {
    userId: string | null;
    permissions: string[];
    isAdmin: boolean;
    isLoading: boolean;
    hasFetched: boolean;
    fetchPermissions: () => Promise<void>;
    updatePermissionsRemotely: (newPermissions: string[], isAdmin?: boolean) => void;
}

export const usePermissionsStore = create<PermissionsState>((set, get) => ({
    userId: null,
    permissions: [],
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
    updatePermissionsRemotely: (newPermissions: string[], isAdmin: boolean = false) => {
        set({ permissions: newPermissions, isAdmin });
    }
}));
