import { toPng } from "html-to-image";

export const ID_VIEWER_EXPORT_PIXEL_RATIO = 2;

export const ID_VIEWER_IMAGE_PLACEHOLDER =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

export interface IdViewerExportOptions {
    readonly pixelRatio?: number;
    readonly imagePlaceholder?: string;
}

export async function exportIdViewerPng(
    element: HTMLElement,
    options?: IdViewerExportOptions,
): Promise<string> {
    const pixelRatio = options?.pixelRatio ?? ID_VIEWER_EXPORT_PIXEL_RATIO;
    const placeholder = options?.imagePlaceholder;
    if (placeholder !== undefined) {
        return toPng(element, { pixelRatio, cacheBust: true, imagePlaceholder: placeholder });
    }
    return toPng(element, { pixelRatio, cacheBust: true });
}

function cleanIdViewerFilenamePart(value: string): string {
    const cleaned = value.trim().replace(/\s+/g, "-").replace(/[^A-Za-z0-9._-]/g, "");
    return cleaned.length > 0 ? cleaned : "unknown";
}

export function idViewerExportFilename(
    side: "front" | "back",
    firstName: string,
    lastName: string,
): string {
    return `ID-${side}-${cleanIdViewerFilenamePart(firstName)}-${cleanIdViewerFilenamePart(lastName)}.png`;
}
