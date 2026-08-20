export type MemoStatus = "Draft" | "Submitted" | "Approved" | "Released" | "Rejected" | "Archived";

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
    created_at?: string | null;
    created_by?: number | UserRelation | null;
    updated_at?: string | null;
    updated_by?: number | UserRelation | null;
    released_by?: number | UserRelation | null;
    released_at?: string | null;
}

export interface Company {
    company_id: number;
    company_name: string;
    company_code: string;
}

export interface AcknowledgementLog {
    id: number | string;
    acknowledged_at: string;
    user_fname: string;
    user_lname: string;
    user_email: string;
    user_id: number;
}

export interface CompanyAcknowledgement {
    company_id: number;
    company_name: string;
    company_code: string;
    status: "success" | "offline";
    error?: string;
    acknowledgements?: AcknowledgementLog[];
}
