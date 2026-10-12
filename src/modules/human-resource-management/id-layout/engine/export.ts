import { toPng } from "html-to-image";

export const ID_EXPORT_PIXEL_RATIO = 2;

export interface IdExportOptions {
    readonly pixelRatio?: number;
    readonly imagePlaceholder?: string;
}

export async function exportIdCardPng(element: HTMLElement, options?: IdExportOptions): Promise<string> {
    const pixelRatio = options?.pixelRatio ?? ID_EXPORT_PIXEL_RATIO;
    const placeholder = options?.imagePlaceholder;
    if (placeholder !== undefined) {
        return toPng(element, { pixelRatio, cacheBust: true, imagePlaceholder: placeholder });
    }
    return toPng(element, { pixelRatio, cacheBust: true });
}

function cleanIdFilenamePart(value: string): string {
    const cleaned = value.trim().replace(/\s+/g, "-").replace(/[^A-Za-z0-9._-]/g, "");
    return cleaned.length > 0 ? cleaned : "unknown";
}

export function idExportFilename(side: "front" | "back", firstName: string, lastName: string): string {
    return `ID-${side}-${cleanIdFilenamePart(firstName)}-${cleanIdFilenamePart(lastName)}.png`;
}
