"use client";

import { useCallback, useEffect, useState } from "react";

import {
    COMPANY_LOGOS_PATH,
    companyLogoDataUrl,
    pickDefaultCompany,
    readCompanyOptions,
    type CompanyOption,
} from "../../utils/company";

export function useSoaCompanies() {
    const [options, setOptions] = useState<CompanyOption[]>([]);
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);
    const [unreachable, setUnreachable] = useState(false);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await fetch(COMPANY_LOGOS_PATH);
                if (!res.ok) {
                    if (!cancelled) {
                        setUnreachable(true);
                        setLoading(false);
                    }
                    return;
                }
                const json: unknown = await res.json().catch(() => null);
                if (cancelled) return;
                const parsed = readCompanyOptions(json);
                if (!parsed || parsed.length === 0) {
                    setUnreachable(true);
                    setLoading(false);
                    return;
                }
                setOptions(parsed);
                const fallback = pickDefaultCompany(parsed);
                if (fallback) setSelectedId(fallback.id);
                setLoading(false);
            } catch {
                if (!cancelled) {
                    setUnreachable(true);
                    setLoading(false);
                }
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    const selectById = useCallback((id: number | null) => {
        setSelectedId(id);
    }, []);

    const selected = options.find((option) => option.id === selectedId) ?? null;

    return {
        options,
        selected,
        selectedId,
        selectById,
        loading,
        unreachable,
        logoDataUrl: companyLogoDataUrl(selected),
    };
}
