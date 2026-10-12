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

// MultiCombobox.tsx — the training-templates MULTISELECT combobox. Its
// chip/toggle/search behaviour is lifted verbatim from the paperwork registry's
// company multiselect (trigger truncate + v4 popover width + item
// truncate/title + checkbox toggles per QA.md §5.2) but parameterised so any
// catalog can drive it: options carry an optional mono `code`, and the search
// placeholder + empty-state copy are props. Picks stay open, selected values
// render as removable Badge chips in the trigger, and Backspace/Delete on the
// closed trigger drops the last pick.

/** One selectable option; `code` renders as a trailing mono value when present. */
export interface MultiComboboxOption {
    value: string;
    label: string;
    code?: string;
}

interface MultiComboboxProps {
    options: MultiComboboxOption[];
    values: string[];
    onValuesChange: (values: string[]) => void;
    /** Trigger placeholder; also the trigger's accessible name when empty. */
    placeholder?: string;
    /** Search box placeholder inside the popover. */
    searchPlaceholder?: string;
    /** Shown when the search matches no option. */
    emptyMessage?: string;
    /** Accessible name; falls back to the placeholder when omitted. */
    ariaLabel?: string;
    disabled?: boolean;
    className?: string;
}

/**
 * Searchable multiselect combobox with removable chips + checkbox toggles.
 * @param props Options, selected values, change handler, and copy overrides.
 * @returns The trigger chips + searchable popover.
 */
export function MultiCombobox({
    options,
    values,
    onValuesChange,
    placeholder = "Select options…",
    searchPlaceholder = "Search…",
    emptyMessage = "No results found.",
    ariaLabel,
    disabled = false,
    className,
}: MultiComboboxProps) {
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
                    aria-label={ariaLabel ?? placeholder}
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
                    <CommandInput placeholder={searchPlaceholder} />
                    <CommandList
                        className="max-h-64 overflow-x-hidden overflow-y-auto overscroll-contain"
                        onWheel={(e) => e.stopPropagation()}
                    >
                        <CommandEmpty>{emptyMessage}</CommandEmpty>
                        <CommandGroup>
                            {options.map((opt) => {
                                const checked = values.includes(opt.value);
                                return (
                                    <CommandItem
                                        key={opt.value}
                                        value={
                                            opt.code === undefined
                                                ? `${opt.label} ${opt.value}`
                                                : `${opt.label} ${opt.code} ${opt.value}`
                                        }
                                        keywords={
                                            opt.code === undefined
                                                ? [opt.label]
                                                : [opt.label, opt.code]
                                        }
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
                                            title={
                                                opt.code === undefined
                                                    ? opt.label
                                                    : `${opt.label} (${opt.code})`
                                            }
                                        >
                                            {opt.label}
                                        </span>
                                        {opt.code !== undefined && (
                                            <span className="ml-2 shrink-0 font-mono text-xs text-muted-foreground">
                                                {opt.code}
                                            </span>
                                        )}
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
