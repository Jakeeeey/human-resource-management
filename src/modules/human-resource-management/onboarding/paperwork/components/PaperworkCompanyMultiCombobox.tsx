"use client";

import * as React from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";

// Module-local MULTISELECT for the paperwork registry (Todo 20).
// Structure mirrors PaperworkCombobox.tsx (trigger truncate + v4 popover
// width + item truncate + title per QA.md §5.2) with checkbox-style toggles:
// picks stay open, selected ids render as removable Badge chips in the
// trigger, Backspace drops the last pick. Values are directory ids as
// strings; labels are company names; search matches name + code.

export interface PaperworkCompanyMultiOption {
    value: string;
    label: string;
    code: string;
}

interface PaperworkCompanyMultiComboboxProps {
    options: PaperworkCompanyMultiOption[];
    values: string[];
    onValuesChange: (values: string[]) => void;
    placeholder?: string;
    disabled?: boolean;
    className?: string;
}

export function PaperworkCompanyMultiCombobox({
    options,
    values,
    onValuesChange,
    placeholder = "Select companies…",
    disabled = false,
    className,
}: PaperworkCompanyMultiComboboxProps) {
    const [open, setOpen] = React.useState(false);

    const selected = React.useMemo(
        () =>
            values
                .map((value) => options.find((opt) => opt.value === value))
                .filter((opt) => opt !== undefined),
        [options, values]
    );

    const toggle = React.useCallback(
        (value: string) => {
            onValuesChange(
                values.includes(value)
                    ? values.filter((v) => v !== value)
                    : [...values, value]
            );
        },
        [values, onValuesChange]
    );

    const removeLast = React.useCallback(() => {
        if (values.length > 0) onValuesChange(values.slice(0, -1));
    }, [values, onValuesChange]);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    aria-label={placeholder}
                    className={cn(
                        "h-auto min-h-10 w-full min-w-0 max-w-full justify-between gap-2 py-1.5",
                        values.length === 0 && "text-muted-foreground",
                        className
                    )}
                    disabled={disabled}
                    onKeyDown={(e) => {
                        if (
                            (e.key === "Backspace" || e.key === "Delete") &&
                            !open
                        ) {
                            e.preventDefault();
                            removeLast();
                        }
                    }}
                >
                    <span className="flex min-w-0 flex-1 flex-wrap items-center gap-1 text-left">
                        {selected.length === 0 ? (
                            <span className="truncate">{placeholder}</span>
                        ) : (
                            selected.map((opt) => (
                                <Badge
                                    key={opt.value}
                                    variant="secondary"
                                    className="max-w-[160px] items-center gap-1 pr-1"
                                    title={opt.label}
                                >
                                    <span className="min-w-0 flex-1 truncate">
                                        {opt.label}
                                    </span>
                                    <span
                                        role="button"
                                        tabIndex={0}
                                        aria-label={`Remove ${opt.label}`}
                                        className="flex h-4 w-4 shrink-0 cursor-pointer items-center justify-center rounded-full hover:bg-muted-foreground/20"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            toggle(opt.value);
                                        }}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter" || e.key === " ") {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                toggle(opt.value);
                                            }
                                        }}
                                    >
                                        <X className="h-3 w-3" />
                                    </span>
                                </Badge>
                            ))
                        )}
                    </span>
                    <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent
                className="w-(--radix-popover-trigger-width) max-w-[calc(100vw-2rem)] overflow-hidden p-0"
                align="start"
            >
                <Command>
                    <CommandInput placeholder="Search companies…" />
                    <CommandList className="max-h-64 overflow-x-hidden overflow-y-auto overscroll-contain">
                        <CommandEmpty>No results found.</CommandEmpty>
                        <CommandGroup>
                            {options.map((opt) => {
                                const checked = values.includes(opt.value);
                                return (
                                    <CommandItem
                                        key={opt.value}
                                        value={`${opt.label} ${opt.code} ${opt.value}`}
                                        keywords={[opt.label, opt.code]}
                                        onSelect={() => toggle(opt.value)}
                                    >
                                        <Check
                                            className={cn(
                                                "mr-2 h-4 w-4 shrink-0",
                                                checked ? "opacity-100" : "opacity-0"
                                            )}
                                        />
                                        <span
                                            className="min-w-0 flex-1 truncate"
                                            title={`${opt.label} (${opt.code})`}
                                        >
                                            {opt.label}
                                        </span>
                                        <span className="ml-2 shrink-0 font-mono text-xs text-muted-foreground">
                                            {opt.code}
                                        </span>
                                    </CommandItem>
                                );
                            })}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}
