"use client";

import { useCallback, useEffect, useState } from "react";

import {
    COMPANY_LOGOS_PATH,
    companyLogoDataUrl,
    fetchEmployeeCompany,
    pickDefaultCompany,
    pickEmployeeCompany,
    readCompanyOptions,
    type CompanyOption,
} from "../../utils/company";

export function useSoaCompanies(requestId?: number | null) {
    const [options, setOptions] = useState<CompanyOption[]>([]);
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);
    const [unreachable, setUnreachable] = useState(false);
    const [employeeCompanyId, setEmployeeCompanyId] = useState<number | null | undefined>(
        requestId === undefined || requestId === null ? null : undefined
    );

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

    useEffect(() => {
        if (requestId === undefined || requestId === null) return;
        let cancelled = false;
        (async () => {
            try {
                const result = await fetchEmployeeCompany({ requestId });
                if (!cancelled) setEmployeeCompanyId(result.company_id);
            } catch {
                if (!cancelled) setEmployeeCompanyId(null);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [requestId]);

    const employeeCompany = typeof employeeCompanyId === "number"
        ? pickEmployeeCompany(options, employeeCompanyId)
        : null;

    const selected = employeeCompany ?? options.find((option) => option.id === selectedId) ?? null;

    return {
        options,
        selected,
        selectedId,
        selectById,
        loading,
        unreachable,
        logoDataUrl: companyLogoDataUrl(selected),
        employeeCompany,
        employeeCompanyLoading: employeeCompanyId === undefined,
    };
}
