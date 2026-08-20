import { Memo, Company } from "../types";

export class MemoReleasingService {
    static async getApprovedMemos(search?: string): Promise<Memo[]> {
        try {
            let url = `/api/hrm/memo-management/memo-releasing`;
            if (search) {
                url += `?memo_no=${encodeURIComponent(search)}`;
            }
            const res = await fetch(url);
            if (!res.ok) return [];
            const { data } = await res.json();
            return data || [];
        } catch (error) {
            console.error("Error fetching approved memos:", error);
            return [];
        }
    }

    static async getCompanies(): Promise<Company[]> {
        try {
            const res = await fetch(`/api/hrm/memo-management/memo-creation/companies?limit=-1&sort=company_name`);
            if (!res.ok) return [];
            const { data } = await res.json();
            return data || [];
        } catch (error) {
            console.error("Error fetching companies:", error);
            return [];
        }
    }

    static async releaseLocal(memoNo: string): Promise<{ success: boolean; company_ids?: number[]; message?: string }> {
        try {
            const res = await fetch(`/api/hrm/memo-management/memo-releasing`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    memo_no: memoNo,
                    action: "release_local"
                })
            });
            const data = await res.json();
            if (!res.ok) {
                return { success: false, message: data.error || "Failed to release memo locally" };
            }
            return {
                success: true,
                company_ids: data.company_ids
            };
        } catch (e) {
            console.error("Release local error:", e);
            return { success: false, message: "Connection error during local release" };
        }
    }

    static async syncCompany(memoNo: string, companyId: number): Promise<{ success: boolean; message?: string }> {
        try {
            const res = await fetch(`/api/hrm/memo-management/memo-releasing`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    memo_no: memoNo,
                    action: "sync_company",
                    company_id: companyId
                })
            });
            const data = await res.json();
            if (!res.ok) {
                return { success: false, message: data.error || "Failed to sync to remote directus" };
            }
            return { success: true };
        } catch (e) {
            console.error("Sync company error:", e);
            return { success: false, message: "Connection error during remote sync" };
        }
    }

    static async updateSyncStatus(memoNo: string, successCount: number, status: string): Promise<{ success: boolean; message?: string }> {
        try {
            const res = await fetch(`/api/hrm/memo-management/memo-releasing`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    memo_no: memoNo,
                    action: "update_sync_status",
                    success_count: successCount,
                    status: status
                })
            });
            const data = await res.json();
            if (!res.ok) {
                return { success: false, message: data.error || "Failed to update local sync status" };
            }
            return { success: true };
        } catch (e) {
            console.error("Update sync status error:", e);
            return { success: false, message: "Connection error during sync status update" };
        }
    }
}
