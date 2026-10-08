"use client";

import type { JSX } from "react";
import { useMemo, useState } from "react";
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

export interface SearchableComboboxOption {
    value: string;
    label: string;
}

export interface SearchableComboboxProps {
    options: readonly SearchableComboboxOption[];
    value?: string;
    onValueChange: (value: string) => void;
    placeholder?: string;
    searchPlaceholder?: string;
    disabled?: boolean;
    id?: string;
    className?: string;
}

function defaultSearchPlaceholder(): string {
    return "Search…";
}

export function SearchableCombobox(props: SearchableComboboxProps): JSX.Element {
    const {
        options,
        value,
        onValueChange,
        placeholder = "Select option...",
        searchPlaceholder,
        disabled = false,
        id,
        className,
    } = props;

    const [open, setOpen] = useState(false);

    const selectedLabel = useMemo(
        () => options.find((opt) => opt.value === value)?.label,
        [options, value]
    );

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    id={id}
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className={cn("w-full min-w-0 max-w-full justify-between", !value && "text-muted-foreground", className)}
                    disabled={disabled}
                >
                    <span className="min-w-0 flex-1 truncate text-left" title={selectedLabel ?? undefined}>
                        {selectedLabel || placeholder}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent
                className="w-(--radix-popover-trigger-width) max-w-[calc(100vw-2rem)] overflow-hidden p-0"
                align="start"
            >
                <Command>
                    <CommandInput placeholder={searchPlaceholder ?? defaultSearchPlaceholder()} />
                    <CommandList
                        className="max-h-64 overflow-x-hidden overflow-y-auto overscroll-contain"
                        onWheel={(e) => e.stopPropagation()}
                    >
                        <CommandEmpty>No results found.</CommandEmpty>
                        <CommandGroup>
                            {options.map((opt) => (
                                <CommandItem
                                    key={opt.value}
                                    value={`${opt.label} ${opt.value}`}
                                    keywords={[opt.label]}
                                    onSelect={() => {
                                        onValueChange(opt.value);
                                        setOpen(false);
                                    }}
                                >
                                    <Check
                                        className={cn(
                                            "mr-2 h-4 w-4",
                                            value === opt.value ? "opacity-100" : "opacity-0"
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
