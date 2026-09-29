function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function resolveRecipient(payload: unknown): string {
    try {
        if (!isRecord(payload)) return "";
        const current = payload.to;
        return typeof current === "string" ? current.trim() : "";
    } catch {
        return "";
    }
}
