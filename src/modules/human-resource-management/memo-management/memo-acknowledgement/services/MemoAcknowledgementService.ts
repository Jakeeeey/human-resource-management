import { Memo, Company, CompanyAcknowledgement } from "../types";

export class MemoAcknowledgementService {
    static async getReleasedMemos(search?: string): Promise<Memo[]> {
        try {
            let url = `/api/hrm/memo-management/memo-acknowledgement`;
            if (search) {
                url += `?memo_no=${encodeURIComponent(search)}`;
            }
            const res = await fetch(url);
            if (!res.ok) return [];
            const { data } = await res.json();
            return data || [];
        } catch (error) {
            console.error("Error fetching released memos:", error);
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

    static async getAcknowledgementLogs(memoNo: string): Promise<CompanyAcknowledgement[]> {
        try {
            const res = await fetch(`/api/hrm/memo-management/memo-acknowledgement?action=fetch_logs&memo_no=${encodeURIComponent(memoNo)}`);
            if (!res.ok) return [];
            const { data } = await res.json();
            return data || [];
        } catch (error) {
            console.error(`Error fetching acknowledgements for memo ${memoNo}:`, error);
            return [];
        }
    }
}
