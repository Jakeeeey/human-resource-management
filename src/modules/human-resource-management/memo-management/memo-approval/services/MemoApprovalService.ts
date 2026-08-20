import { Memo, Company } from "../types";

export class MemoApprovalService {
    static async getSubmittedMemos(search?: string): Promise<Memo[]> {
        try {
            let url = `/api/hrm/memo-management/memo-approval`;
            if (search) {
                url += `?memo_no=${encodeURIComponent(search)}`;
            }
            const res = await fetch(url);
            if (!res.ok) return [];
            const { data } = await res.json();
            return data || [];
        } catch (error) {
            console.error("Error fetching submitted memos:", error);
            return [];
        }
    }

    static async getCompanies(): Promise<Company[]> {
        try {
            // Fetch companies list (needed for resolving names in target list)
            const res = await fetch(`/api/hrm/memo-management/memo-creation/companies?limit=-1&sort=company_name`);
            if (!res.ok) return [];
            const { data } = await res.json();
            return data || [];
        } catch (error) {
            console.error("Error fetching companies:", error);
            return [];
        }
    }

    static async approveMemos(memoNos: string[]): Promise<{ success: boolean; message?: string; failedCompanies?: string[] }> {
        try {
            const res = await fetch(`/api/hrm/memo-management/memo-approval`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    memo_nos: memoNos,
                    action: "approve"
                })
            });
            const data = await res.json();
            if (!res.ok) {
                return { success: false, message: data.error || "Failed to approve memos" };
            }
            return {
                success: true,
                failedCompanies: data.failedCompanies
            };
        } catch (e) {
            console.error("Approve error:", e);
            return { success: false, message: "Connection error during approval" };
        }
    }

    static async rejectMemos(memoNos: string[]): Promise<{ success: boolean; message?: string }> {
        try {
            const res = await fetch(`/api/hrm/memo-management/memo-approval`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    memo_nos: memoNos,
                    action: "reject"
                })
            });
            const data = await res.json();
            if (!res.ok) {
                return { success: false, message: data.error || "Failed to reject memos" };
            }
            return { success: true };
        } catch (e) {
            console.error("Reject error:", e);
            return { success: false, message: "Connection error during rejection" };
        }
    }
}
