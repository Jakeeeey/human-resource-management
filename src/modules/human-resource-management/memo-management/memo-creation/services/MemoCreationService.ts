import { Memo, Company } from "../types";

export class MemoCreationService {
    static async getMemos(search?: string): Promise<Memo[]> {
        try {
            let url = `/api/hrm/memo-management/memo-creation/memos?sort=-created_at`;
            if (search) {
                url += `&memo_no=${encodeURIComponent(search)}`;
            }
            const res = await fetch(url);
            if (!res.ok) return [];
            const { data } = await res.json();
            return data || [];
        } catch (error) {
            console.error("Error fetching memos:", error);
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

    static async uploadAttachment(file: File): Promise<{ file_url: string; file_name: string } | null> {
        try {
            const formData = new FormData();
            formData.append("file", file);
            const res = await fetch(`/api/hrm/memo-management/memo-creation/upload`, {
                method: "POST",
                body: formData
            });
            if (!res.ok) return null;
            const data = await res.json();
            return {
                file_url: data.id,
                file_name: data.filename || file.name
            };
        } catch (e) {
            console.error("Upload error", e);
            return null;
        }
    }

    static async createMemo(
        memoData: Partial<Memo>,
        attachmentFiles: { file_url: string; file_name: string }[]
    ): Promise<{ success: boolean; message?: string; data?: unknown }> {
        try {
            const response = await fetch(`/api/hrm/memo-management/memo-creation/memos`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    subject: memoData.subject,
                    body: memoData.body,
                    from: memoData.from,
                    start_date: memoData.start_date,
                    end_date: memoData.end_date,
                    company_ids: memoData.company_ids,
                    attachments: attachmentFiles
                })
            });
            
            const resJson = await response.json();
            if (!response.ok) {
                return { success: false, message: resJson.error || "Failed to create memo." };
            }
            
            return {
                success: true,
                data: resJson.data,
                message: resJson.failedCompanies && resJson.failedCompanies.length > 0
                    ? `Saved successfully, but failed to sync on: ${resJson.failedCompanies.join(", ")}`
                    : undefined
            };
        } catch (error) {
            console.error("Error creating memo:", error);
            return { success: false, message: "Connection error." };
        }
    }

    static async updateMemo(
        memoNo: string,
        memoData: Partial<Memo>,
        attachmentFiles: { id?: string | number; file_url: string; file_name: string }[]
    ): Promise<{ success: boolean; message?: string; data?: unknown }> {
        try {
            const response = await fetch(`/api/hrm/memo-management/memo-creation/memos?memo_no=${memoNo}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    subject: memoData.subject,
                    body: memoData.body,
                    start_date: memoData.start_date,
                    end_date: memoData.end_date,
                    status: memoData.status,
                    attachments: attachmentFiles
                })
            });

            const resJson = await response.json();
            if (!response.ok) {
                return { success: false, message: resJson.error || "Failed to update memo." };
            }

            return {
                success: true,
                data: resJson.data,
                message: resJson.failedCompanies && resJson.failedCompanies.length > 0
                    ? `Updated successfully, but failed to sync on: ${resJson.failedCompanies.join(", ")}`
                    : undefined
            };
        } catch (error) {
            console.error("Error updating memo:", error);
            return { success: false, message: "Connection error." };
        }
    }

    static async submitMemo(memoNo: string): Promise<{ success: boolean; message?: string }> {
        try {
            const response = await fetch(`/api/hrm/memo-management/memo-creation/memos?memo_no=${memoNo}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: "Submitted" })
            });
            const resJson = await response.json();
            if (!response.ok) {
                return { success: false, message: resJson.error || "Failed to submit memo." };
            }
            return {
                success: true,
                message: resJson.failedCompanies && resJson.failedCompanies.length > 0
                    ? `Submitted successfully, but failed to sync on: ${resJson.failedCompanies.join(", ")}`
                    : undefined
            };
        } catch (error) {
            console.error("Error submitting memo:", error);
            return { success: false, message: "Connection error." };
        }
    }

    static async deleteMemo(memoNo: string): Promise<{ success: boolean; message?: string }> {
        try {
            const response = await fetch(`/api/hrm/memo-management/memo-creation/memos?memo_no=${memoNo}`, {
                method: "DELETE"
            });
            const resJson = await response.json();
            if (!response.ok) {
                return { success: false, message: resJson.error || "Failed to delete memo." };
            }
            return {
                success: true,
                message: resJson.failedCompanies && resJson.failedCompanies.length > 0
                    ? `Deleted successfully, but failed to remove from: ${resJson.failedCompanies.join(", ")}`
                    : undefined
            };
        } catch (error) {
            console.error("Error deleting memo:", error);
            return { success: false, message: "Connection error." };
        }
    }
}
