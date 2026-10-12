"use client";

import { useEffect, useState } from "react";

import { COMPANY_LOGOS_PATH, readCompanyOptions, type CompanyOption } from "../../utils/company";

export function useCompanyOptions() {
    const [options, setOptions] = useState<CompanyOption[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await fetch(COMPANY_LOGOS_PATH);
                if (!res.ok) throw new Error("company-logos unreachable");
                const body: unknown = await res.json().catch(() => null);
                const parsed = readCompanyOptions(body);
                if (!parsed || parsed.length === 0) throw new Error("company-logos empty");
                if (!cancelled) setOptions(parsed);
            } catch {
                if (!cancelled) setError("Could not load companies. The company list is unavailable.");
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    return { options, isLoading, error };
}
