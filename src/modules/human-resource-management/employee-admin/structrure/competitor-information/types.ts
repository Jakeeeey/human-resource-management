export interface SystemUser {
	user_id: number;
	user_fname: string;
	user_mname?: string | null;
	user_lname: string;
	user_email?: string;
	[key: string]: unknown;
}

export interface Competitor {
	id: number;
	name: string;
	website?: string | null;
	province?: string | null;
	city?: string | null;
	barangay?: string | null;
	created_at?: string | null;
	created_by?: SystemUser | number | string | null;
	updated_by?: SystemUser | number | string | null;
}

export interface CompetitorFormData {
	name: string;
	website?: string | null;
	province?: string | null;
	city?: string | null;
	barangay?: string | null;
}

export interface PsgcItem {
	code: string;
	name: string;
	[key: string]: unknown;
}
