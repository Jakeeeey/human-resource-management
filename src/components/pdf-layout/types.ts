import type { UserOptions } from 'jspdf-autotable';
import jsPDF from 'jspdf';

export interface Company {
    company_id: number;
    company_name: string | null;
    company_type: string | null;
    company_code: string;
    company_address: string | null;
    company_brgy: string | null;
    company_city: string | null;
    company_province: string | null;
    company_zipCode: string | null;
    company_registrationNumber: string | null;
    company_tin: string | null;
    company_dateAdmitted: string | null; // Date string
    company_contact: string | null;
    company_email: string | null;
    company_outlook: string | null;
    company_gmail: string | null;
    company_department: string | null;
    company_logo: string | null; // Base64 or URL
    company_facebook: string | null;
    company_website: string | null;
    company_tags: string | null;
}

export interface PdfLayoutOptions {
    company?: Company;
    /** Optionally pass table options directly mapped to jspdf-autotable */
    tableOptions?: UserOptions;
    /** Optional body content rendering function if not using a table */
    renderBody?: (doc: jsPDF, startY: number) => number;
    /** Filename for downloading */
    filename?: string;
    /** Orientation of the PDF */
    orientation?: 'p' | 'portrait' | 'l' | 'landscape';
}
