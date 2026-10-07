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
import type { CompanyOption } from "../utils/company";
import { defaultCompany, loadCompanyOptions } from "../providers/quitClaimClient";

interface QuitClaimCompanySelectProps {
    value: CompanyOption | null;
    onValueChange: (company: CompanyOption | null) => void;
    preferredCompanyCode?: string;
    disabled?: boolean;
    id?: string;
}

export function QuitClaimCompanySelect({
    value,
    onValueChange,
    preferredCompanyCode,
    disabled = false,
    id,
}: QuitClaimCompanySelectProps): JSX.Element {
    const [options, setOptions] = useState<CompanyOption[]>([]);
    const [failed, setFailed] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        (async () => {
            try {
                const rows = await loadCompanyOptions();
                if (cancelled) {
                    return;
                }
                setOptions(rows);
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
    }, []);

    useEffect(() => {
        if (!loading && !failed && value === null && options.length > 0) {
            onValueChange(defaultCompany(options, preferredCompanyCode));
        }
    }, [loading, failed, value, options, onValueChange, preferredCompanyCode]);

    if (loading) {
        return <p className="text-xs text-muted-foreground">Loading companies…</p>;
    }

    if (failed || options.length === 0) {
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
                const found = options.find((option) => String(option.id) === next) ?? null;
                onValueChange(found);
            }}
            disabled={disabled}
        >
            <SelectTrigger id={id} className="w-full">
                <SelectValue placeholder="Select a company" />
            </SelectTrigger>
            <SelectContent>
                {options.map((option) => (
                    <SelectItem key={option.id} value={String(option.id)}>
                        {option.company_name}
                        {option.is_default ? " (default)" : ""}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}
