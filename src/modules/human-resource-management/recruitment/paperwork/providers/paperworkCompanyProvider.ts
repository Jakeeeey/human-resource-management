// Company directory for the paperwork registry (read-only over the existing
// memo companies proxy — routes are shared surface, not module code, so reuse
// is allowed). Rows carry BOTH id and code — combobox values are ids
// (junction grain), labels are names.

export interface PaperworkCompany {
    id: number;
    code: string;
    name: string;
}

interface CompanyListRow {
    company_id?: unknown;
    company_code?: unknown;
    company_name?: unknown;
}

/**
 * Lists companies as combobox options (id value, name label), blanks
 * dropped. Rows without a numeric id are skipped — the junction grain is
 * `company_id INT`, so id-less rows can never be picked. Never throws —
 * failure yields [] and the dialog blocks saving with a retry hint.
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
            const id =
                typeof row?.company_id === "number"
                    ? row.company_id
                    : typeof row?.company_id === "string" && row.company_id.trim() !== ""
                      ? Number(row.company_id)
                      : NaN;
            const code = typeof row?.company_code === "string" ? row.company_code.trim() : "";
            const name = typeof row?.company_name === "string" ? row.company_name.trim() : "";
            if (!Number.isInteger(id) || id <= 0) continue;
            if (!code || seen.has(code)) continue;
            seen.add(code);
            options.push({ id, code, name: name || code });
        }
        return options;
    } catch {
        return [];
    }
}
