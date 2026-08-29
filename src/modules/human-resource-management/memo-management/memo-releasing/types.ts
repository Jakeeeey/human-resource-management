export type MemoStatus = "Draft" | "Submitted" | "Approved" | "Released" | "Partially Released" | "Rejected" | "Archived";

export interface CompanyMemoAttachment {
    id?: string | number;
    company_memo_id: number;
    file_url: string;
    file_name: string;
}

export interface UserRelation {
    user_id: number;
    user_fname: string;
    user_lname: string;
    user_email: string;
}

export interface Memo {
    id: string | number;
    memo_no: string;
    subject: string;
    body?: string | null;
    from: number; // Origin company_id (sender)
    company_ids: number[]; // Array of selected receiver company_ids
    start_date: string;
    end_date: string;
    status: MemoStatus;
    attachments?: CompanyMemoAttachment[];
    created_at?: string | null;
    created_by?: number | UserRelation | null;
    updated_at?: string | null;
    updated_by?: number | UserRelation | null;
    approved_by?: number | UserRelation | null;
    approved_at?: string | null;
    rejected_by?: number | UserRelation | null;
    rejected_at?: string | null;
    synced_companies_count?: number;
}

export interface Company {
    company_id: number;
    company_name: string;
    company_code: string;
    directus?: string;
    directus_token?: string;
}
