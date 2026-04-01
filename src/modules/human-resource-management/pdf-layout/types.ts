import { 
    PdfConfig, 
    CompanyData, 
    PdfElementConfig,
    PageNumberConfig,
    PaperSize
} from "@/components/pdf-layout-design/types";

export interface PdfTemplate {
    id: number;
    name: string;
    config: PdfConfig;
    created_at?: string;
    updated_at?: string;
}

export type { 
    PdfConfig, 
    CompanyData, 
    PdfElementConfig,
    PageNumberConfig,
    PaperSize
};
