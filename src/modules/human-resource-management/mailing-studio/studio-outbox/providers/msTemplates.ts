import { msGet } from "./msApi";

export interface MsTemplateDirectoryEntry {
    readonly id: unknown;
    readonly name: string;
    readonly subject: string;
}

interface MsTemplateListRow {
    readonly id?: unknown;
    readonly template_key?: unknown;
    readonly template_name?: unknown;
    readonly subject?: unknown;
}

function entryName(row: MsTemplateListRow): string {
    if (typeof row.template_name === "string" && row.template_name.trim() !== "") {
        return row.template_name;
    }
    if (typeof row.template_key === "string" && row.template_key.trim() !== "") {
        return row.template_key;
    }
    return `Template ${String(row.id ?? "")}`.trim();
}

export async function fetchMsTemplateDirectory(): Promise<MsTemplateDirectoryEntry[]> {
    const data = await msGet<MsTemplateListRow[]>("/studio-templates");
    if (!Array.isArray(data)) return [];
    return data.map((row) => ({
        id: row.id ?? null,
        name: entryName(row),
        subject: typeof row.subject === "string" ? row.subject : "",
    }));
}
