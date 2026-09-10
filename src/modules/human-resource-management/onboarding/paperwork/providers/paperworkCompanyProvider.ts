// Company directory for the paperwork registry (read-only over the existing
// memo companies proxy — routes are shared surface, not module code, so reuse
// is allowed). Options are company codes (stable scope keys) labeled by name.

export interface PaperworkCompany {
    code: string;
    name: string;
}

interface CompanyListRow {
    company_code?: unknown;
    company_name?: unknown;
}

/**
 * Lists companies as combobox options (code value, name label), blanks
 * dropped. Never throws — failure yields [] and the caller falls back to a
 * free-text input so template creation is never blocked.
 * @returns Company options, possibly empty.
 */
export async function listPaperworkCompanies(): Promise<PaperworkCompany[]> {
    try {
        const res = await fetch(
            "/api/hrm/memo-management/memo-creation/companies?limit=-1&sort=company_name"
        );
        if (!res.ok) return [];
        const body = (await res.json()) as { data?: CompanyListRow[] };
        if (!Array.isArray(body?.data)) return [];
        const seen = new Set<string>();
        const options: PaperworkCompany[] = [];
        for (const row of body.data) {
            const code = typeof row?.company_code === "string" ? row.company_code.trim() : "";
            const name = typeof row?.company_name === "string" ? row.company_name.trim() : "";
            if (!code || seen.has(code)) continue;
            seen.add(code);
            options.push({ code, name: name || code });
        }
        return options;
    } catch {
        return [];
    }
}
