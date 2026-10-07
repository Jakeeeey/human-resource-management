const ASSET_URL_PATTERN =
    /https?:\/\/[^\s"'<>]+\/assets\/([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})/g;
const CID_SRC_PATTERN =
    /src=(["'])cid:([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})\1/g;

export function msPreviewAssetUrls(designJson: string): Map<string, string> {
    const urls = new Map<string, string>();
    if (typeof designJson !== "string" || designJson.length === 0) return urls;
    ASSET_URL_PATTERN.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = ASSET_URL_PATTERN.exec(designJson)) !== null) {
        const id = match[1] ?? "";
        const url = match[0] ?? "";
        if (id.length > 0 && url.length > 0 && !urls.has(id.toLowerCase())) {
            urls.set(id.toLowerCase(), url);
        }
    }
    return urls;
}

export function msCidHtmlToPreviewHtml(
    html: string,
    designJson: string | null | undefined,
): string {
    if (typeof html !== "string" || html.length === 0) return html;
    if (typeof designJson !== "string" || designJson.length === 0) return html;
    const urls = msPreviewAssetUrls(designJson);
    if (urls.size === 0) return html;
    return html.replace(CID_SRC_PATTERN, (whole: string, quote: string, id: string) => {
        const url = urls.get(String(id).toLowerCase());
        return typeof url === "string" ? `src=${quote}${url}${quote}` : whole;
    });
}
