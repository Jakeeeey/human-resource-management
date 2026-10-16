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

    const refreshEmployeeCompany = useCallback(async () => {
        if (requestId === undefined || requestId === null) return;
        try {
            const result = await fetchEmployeeCompany({ requestId });
            setEmployeeCompanyId(result.company_id);
        } catch {
            setEmployeeCompanyId(null);
        }
    }, [requestId]);

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

    const selected = employeeCompany ?? pickDefaultCompany(options);

    return {
        options,
        selected,
        loading,
        unreachable,
        logoDataUrl: companyLogoDataUrl(selected),
        employeeCompany,
        employeeCompanyLoading: employeeCompanyId === undefined,
        refreshEmployeeCompany,
    };
}
