"use client";

import { useState } from "react";
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

export interface ClearanceRequestOption {
    value: string;
    label: string;
}

export function ClearanceRequestCombobox(props: {
    options: readonly ClearanceRequestOption[];
    value: string;
    onValueChange: (value: string) => void;
    id?: string;
    disabled?: boolean;
    placeholder?: string;
    emptyMessage?: string;
}): JSX.Element {
    const { options, value, onValueChange, id, disabled = false, placeholder, emptyMessage } = props;

    const normalizedValue = value.trim() === "" ? "" : value.trim();
    const resolvedPlaceholder = placeholder ?? "Select a clearance form…";

    const selectedLabel = options.find((option) => option.value === normalizedValue)?.label;

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
                    <span className="min-w-0 flex-1 truncate text-left">
                        {selectedLabel || resolvedPlaceholder}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
                <Command>
                    <CommandInput placeholder="Search clearance forms…" />
                    <div
                        className="max-h-64 overflow-y-auto overscroll-contain"
                        onWheel={(event) => {
                            event.stopPropagation();
                            const target = event.currentTarget;
                            target.scrollTop += event.deltaY;
                        }}
                    >
                        <CommandList className="max-h-none overflow-visible">
                            <CommandEmpty>{emptyMessage ?? "No clearance form matches your search."}</CommandEmpty>
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
