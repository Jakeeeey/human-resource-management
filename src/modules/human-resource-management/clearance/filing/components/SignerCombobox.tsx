"use client";

import { useMemo } from "react";
import type { JSX } from "react";

import {
    Combobox,
    ComboboxContent,
    ComboboxEmpty,
    ComboboxInput,
    ComboboxItem,
    ComboboxList,
} from "@/components/ui/combobox";
import type { FilingCandidate } from "../providers/clearanceFilingClient";

interface SignerOption {
    value: string;
    label: string;
}

export function toSignerOptions(candidates: readonly FilingCandidate[]): SignerOption[] {
    const totals = new Map<string, number>();
    for (const candidate of candidates) {
        const base = toSignerBaseLabel(candidate);
        totals.set(base, (totals.get(base) ?? 0) + 1);
    }
    const seen = new Map<string, number>();
    return candidates.map((candidate) => {
        const base = toSignerBaseLabel(candidate);
        const total = totals.get(base) ?? 1;
        const occurrence = (seen.get(base) ?? 0) + 1;
        seen.set(base, occurrence);
        return {
            value: String(candidate.user_id),
            label: total > 1 ? `${base} · ${occurrence} of ${total}` : base,
        };
    });
}

function toSignerBaseLabel(candidate: FilingCandidate): string {
    const segments = [candidate.full_name.trim() === "" ? "Unnamed team member" : candidate.full_name];
    if (candidate.department_name && candidate.department_name.trim() !== "") {
        segments.push(candidate.department_name.trim());
    }
    const base = segments.join(" — ");
    return candidate.is_department_head ? `${base} (Head)` : base;
}

export function SignerCombobox(props: {
    candidates: readonly FilingCandidate[];
    value: string;
    onValueChange: (value: string) => void;
    id?: string;
    disabled?: boolean;
    placeholder?: string;
    emptyMessage?: string;
}): JSX.Element {
    const { candidates, value, onValueChange, id, disabled = false, placeholder, emptyMessage } = props;

    const options = useMemo(() => toSignerOptions(candidates), [candidates]);

    const labelByValue = useMemo(() => {
        const map = new Map<string, string>();
        for (const option of options) {
            map.set(option.value, option.label);
        }
        return map;
    }, [options]);

    const normalizedValue = value.trim() === "" ? null : value.trim();
    const resolvedPlaceholder =
        placeholder ?? (candidates.length > 0 ? `Search ${candidates.length} signers…` : "Select a signer…");

    return (
        <Combobox
            items={options.map((option) => option.value)}
            value={normalizedValue}
            onValueChange={(next) => onValueChange(next ?? "")}
            itemToStringLabel={(itemValue) => labelByValue.get(itemValue) ?? itemValue}
            filter={(itemValue, query, itemToString) => {
                const label = (itemToString ? itemToString(itemValue) : itemValue).toLowerCase();
                return label.includes(query.trim().toLowerCase());
            }}
            disabled={disabled}
        >
            <ComboboxInput
                id={id}
                placeholder={resolvedPlaceholder}
                disabled={disabled}
                showClear={normalizedValue !== null}
            />
            <ComboboxContent>
                <ComboboxEmpty>{emptyMessage ?? "No signer matches your search."}</ComboboxEmpty>
                <ComboboxList>
                    {(item: string) => (
                        <ComboboxItem key={item === "" ? "none" : item} value={item}>
                            <span className="min-w-0 flex-1 truncate" title={labelByValue.get(item) ?? item}>
                                {labelByValue.get(item) ?? item}
                            </span>
                        </ComboboxItem>
                    )}
                </ComboboxList>
            </ComboboxContent>
        </Combobox>
    );
}
