"use client";

import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";

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
import { cn } from "@/lib/utils";

export interface MsComboboxOption {
    readonly value: string;
    readonly label: string;
}

interface MsComboboxProps {
    readonly options: readonly MsComboboxOption[];
    readonly value: string;
    readonly onValueChange: (value: string) => void;
    readonly placeholder?: string;
    readonly searchPlaceholder?: string;
    readonly emptyText?: string;
    readonly disabled?: boolean;
    readonly id?: string;
    readonly ariaLabel?: string;
}

/**
 * Studio combobox — the module-local copy of the canonical Popover+Command
 * pattern (QA §5.2): role=combobox trigger with truncate+title, CommandInput
 * search, capped scroll list, Check toggle. DB-sourced pickers (event keys,
 * templates) use this; short fixed enums use Radix Select instead.
 */
export function MsCombobox({
    options,
    value,
    onValueChange,
    placeholder = "Select option…",
    searchPlaceholder,
    emptyText = "No results found.",
    disabled = false,
    id,
    ariaLabel,
}: MsComboboxProps) {
    const [open, setOpen] = React.useState(false);

    const selectedLabel = React.useMemo(() => {
        return options.find((opt) => opt.value === value)?.label;
    }, [options, value]);

    const stopWheel = React.useCallback((event: React.WheelEvent) => {
        event.stopPropagation();
    }, []);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    aria-expanded={open}
                    aria-label={ariaLabel}
                    className={cn(
                        "h-8 w-full min-w-0 max-w-full justify-between pr-2 text-xs font-normal",
                        !value && "text-muted-foreground",
                    )}
                    disabled={disabled}
                    id={id}
                    role="combobox"
                    variant="outline"
                >
                    <span className="min-w-0 flex-1 truncate text-left" title={selectedLabel ?? undefined}>
                        {selectedLabel ?? placeholder}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent
                align="start"
                className="w-(--radix-popover-trigger-width) max-w-[calc(100vw-2rem)] overflow-hidden p-0"
            >
                <Command>
                    <CommandInput placeholder={searchPlaceholder ?? `Search ${placeholder.toLowerCase().replace(/…$/, "")}…`} />
                    <CommandList
                        className="max-h-64 overflow-x-hidden overflow-y-auto overscroll-contain"
                        onWheel={stopWheel}
                    >
                        <CommandEmpty>{emptyText}</CommandEmpty>
                        <CommandGroup>
                            {options.map((opt) => (
                                <CommandItem
                                    key={opt.value}
                                    keywords={[opt.label]}
                                    value={`${opt.label} ${opt.value}`}
                                    onSelect={() => {
                                        onValueChange(opt.value);
                                        setOpen(false);
                                    }}
                                >
                                    <Check
                                        className={cn(
                                            "mr-2 h-4 w-4 shrink-0",
                                            value === opt.value ? "opacity-100" : "opacity-0",
                                        )}
                                    />
                                    <span className="min-w-0 flex-1 truncate" title={opt.label}>
                                        {opt.label}
                                    </span>
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}
