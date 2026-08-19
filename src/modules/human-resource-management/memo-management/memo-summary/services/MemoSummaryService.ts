import { Memo, Company } from "../types";

export class MemoSummaryService {
    static async getMemos(): Promise<Memo[]> {
        try {
            const res = await fetch(`/api/hrm/memo-management/memo-summary`);
            if (!res.ok) return [];
            const { data } = await res.json();
            return data || [];
        } catch (error) {
            console.error("Error fetching summary memos:", error);
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
}
