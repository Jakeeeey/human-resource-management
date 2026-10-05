"use client";

import { useMemo, useState } from "react";
import type { JSX } from "react";
import { Check, ChevronsUpDown } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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

    const normalizedValue = value.trim() === "" ? "" : value.trim();
    const resolvedPlaceholder =
        placeholder ?? (candidates.length > 0 ? `Search ${candidates.length} signers…` : "Select a signer…");

    const selectedLabel = useMemo(
        () => options.find((option) => option.value === normalizedValue)?.label,
        [options, normalizedValue]
    );

    const [open, setOpen] = useState(false);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    id={id}
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className={cn("w-full justify-between", !normalizedValue && "text-muted-foreground")}
                    disabled={disabled}
                >
                    {selectedLabel || resolvedPlaceholder}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
                <Command>
                    <CommandInput placeholder={`Search ${resolvedPlaceholder.toLowerCase()}...`} />
                    <div
                        className="max-h-64 overflow-y-auto overscroll-contain"
                        onWheel={(event) => {
                            event.stopPropagation();
                            const target = event.currentTarget;
                            target.scrollTop += event.deltaY;
                        }}
                    >
                        <CommandList className="max-h-none overflow-visible">
                            <CommandEmpty>{emptyMessage ?? "No signer matches your search."}</CommandEmpty>
                            <CommandGroup>
                                {options.map((option) => (
                                    <CommandItem
                                        key={option.value}
                                        value={option.label}
                                        onSelect={() => {
                                            onValueChange(option.value);
                                            setOpen(false);
                                        }}
                                    >
                                        <Check
                                            className={cn(
                                                "mr-2 h-4 w-4 shrink-0",
                                                normalizedValue === option.value ? "opacity-100" : "opacity-0"
                                            )}
                                        />
                                        <span className="min-w-0 flex-1 whitespace-normal wrap-break-word">
                                            {option.label}
                                        </span>
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        </CommandList>
                    </div>
                </Command>
            </PopoverContent>
        </Popover>
    );
}
