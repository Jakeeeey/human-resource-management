import { msScrubSecretsFromText } from "./mail-transport";

export const MS_INLINE_IMAGE_WARN_BYTES = 2 * 1024 * 1024;

export interface MsAssetBytes {
    bytes: Buffer;
    contentType: string;
    size: number;
}

export function msCidRefsInHtml(html: string): string[] {
    if (typeof html !== "string" || html.length === 0) return [];
    const found: string[] = [];
    const seen = new Set<string>();
    const pattern =
        /cid:([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})/g;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(html)) !== null) {
        const id = match[1];
        if (typeof id === "string" && id.length > 0 && !seen.has(id)) {
            seen.add(id);
            found.push(id);
        }
    }
    return found;
}

function msAssetExtension(contentType: string): string {
    const type = contentType.toLowerCase();
    if (type === "image/jpeg") return ".jpg";
    if (type === "image/png") return ".png";
    if (type === "image/gif") return ".gif";
    if (type === "image/webp") return ".webp";
    if (type === "image/svg+xml") return ".svg";
    return ".bin";
}

export function msAssetFilename(assetId: string, contentType: string): string {
    return `${assetId}${msAssetExtension(contentType)}`;
}

export async function fetchMsAssetBytes(assetId: string): Promise<MsAssetBytes> {
    const base = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").trim().replace(/\/+$/, "");
    const token = (process.env.DIRECTUS_STATIC_TOKEN ?? "").trim();
    if (base.length === 0 || token.length === 0) {
        throw new Error(
            msScrubSecretsFromText("ms-asset-fetch: Directus base URL or token is not configured"),
        );
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
        const res = await fetch(`${base}/assets/${encodeURIComponent(assetId)}`, {
            headers: { Authorization: `Bearer ${token}` },
            signal: controller.signal,
        });
        if (!res.ok) {
            throw new Error(
                msScrubSecretsFromText(
                    `ms-asset-fetch: asset request failed with status ${res.status}`,
                ),
            );
        }
        const headerType = res.headers.get("content-type");
        const rawType = typeof headerType === "string" ? headerType.split(";")[0] : "";
        const contentType =
            typeof rawType === "string" && rawType.trim().length > 0
                ? rawType.trim()
                : "application/octet-stream";
        const buffer = Buffer.from(await res.arrayBuffer());
        return { bytes: buffer, contentType, size: buffer.byteLength };
    } catch (error) {
        if (error instanceof Error) {
            throw new Error(msScrubSecretsFromText(error.message));
        }
        throw new Error(msScrubSecretsFromText("ms-asset-fetch: asset request failed"));
    } finally {
        clearTimeout(timer);
    }
}
