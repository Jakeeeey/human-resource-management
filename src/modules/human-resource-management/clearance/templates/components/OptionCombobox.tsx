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

export interface ClearanceOption {
    value: string;
    label: string;
}

function defaultSearchPlaceholder(): string {
    return "Search…";
}

export function OptionCombobox(props: {
    options: readonly ClearanceOption[];
    value: string;
    onValueChange: (value: string) => void;
    placeholder?: string;
    searchPlaceholder?: string;
    disabled?: boolean;
    id?: string;
    emptyMessage?: string;
}): JSX.Element {
    const {
        options,
        value,
        onValueChange,
        placeholder = "Select an option",
        searchPlaceholder,
        disabled = false,
        id,
        emptyMessage = "No results found.",
    } = props;

    const [open, setOpen] = useState(false);

    const selectedLabel = useMemo(
        () => options.find((option) => option.value === value)?.label,
        [options, value],
    );

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    id={id}
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className={cn("w-full justify-between", !value && "text-muted-foreground")}
                    disabled={disabled}
                >
                    {selectedLabel || placeholder}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
                <Command>
                    <CommandInput placeholder={searchPlaceholder ?? defaultSearchPlaceholder()} />
                    <div
                        className="max-h-64 overflow-y-auto overscroll-contain"
                        onWheel={(event) => {
                            event.stopPropagation();
                            const target = event.currentTarget;
                            target.scrollTop += event.deltaY;
                        }}
                    >
                        <CommandList className="max-h-none overflow-visible">
                            <CommandEmpty>{emptyMessage}</CommandEmpty>
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
                                                value === option.value ? "opacity-100" : "opacity-0",
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
