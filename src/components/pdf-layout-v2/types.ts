export type ElementType = 'text' | 'image' | 'line';

export interface LayoutElement {
    id: string;
    type: ElementType;
    x: number;
    y: number;
    width: number;
    height: number;
    content?: string; // Text content or Image Base64
    fieldKey?: string; // e.g. 'company_name', 'company_logo', etc.
    fontSize?: number;
    fontWeight?: 'normal' | 'bold';
    thickness?: number; // For lines
    color?: string;
}

export interface PdfV2Layout {
    elements: LayoutElement[];
    pageSize: {
        width: number;
        height: number;
    };
}
