"use client";

import { useEffect, useState } from "react";
import type { JSX } from "react";

import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import type { CompanyOption } from "../../utils/company";
import { defaultCompany, loadCompanyOptions } from "../providers/quitClaimClient";

interface QuitClaimCompanySelectProps {
    value: CompanyOption | null;
    onValueChange: (company: CompanyOption | null) => void;
    preferredCompanyCode?: string;
    disabled?: boolean;
    id?: string;
    options?: CompanyOption[];
}

export function QuitClaimCompanySelect({
    value,
    onValueChange,
    preferredCompanyCode,
    disabled = false,
    id,
    options: providedOptions,
}: QuitClaimCompanySelectProps): JSX.Element {
    const [internalOptions, setInternalOptions] = useState<CompanyOption[]>([]);
    const [failed, setFailed] = useState(false);
    const [loading, setLoading] = useState(providedOptions === undefined);

    useEffect(() => {
        if (providedOptions !== undefined) return;
        let cancelled = false;
        setLoading(true);
        (async () => {
            try {
                const rows = await loadCompanyOptions();
                if (cancelled) {
                    return;
                }
                setInternalOptions(rows);
                setFailed(rows.length === 0);
            } catch {
                if (!cancelled) {
                    setFailed(true);
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [providedOptions]);

    const resolvedOptions = providedOptions ?? internalOptions;
    const resolvedLoading = providedOptions !== undefined ? false : loading;
    const resolvedFailed = providedOptions !== undefined ? providedOptions.length === 0 : failed;

    useEffect(() => {
        if (!resolvedLoading && !resolvedFailed && value === null && resolvedOptions.length > 0) {
            onValueChange(defaultCompany(resolvedOptions, preferredCompanyCode));
        }
    }, [resolvedLoading, resolvedFailed, value, resolvedOptions, onValueChange, preferredCompanyCode]);

    if (resolvedLoading) {
        return <p className="text-xs text-muted-foreground">Loading companies…</p>;
    }

    if (resolvedFailed || resolvedOptions.length === 0) {
        return (
            <p className="text-xs text-muted-foreground">
                The company list is unreachable. The letterhead will print without company details.
            </p>
        );
    }

    return (
        <Select
            value={value ? String(value.id) : ""}
            onValueChange={(next) => {
                const found = resolvedOptions.find((option) => String(option.id) === next) ?? null;
                onValueChange(found);
            }}
            disabled={disabled}
        >
            <SelectTrigger id={id} className="w-full">
                <SelectValue placeholder="Select a company" />
            </SelectTrigger>
            <SelectContent>
                {resolvedOptions.map((option) => (
                    <SelectItem key={option.id} value={String(option.id)}>
                        {option.company_name}
                        {option.is_default ? " (default)" : ""}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}
