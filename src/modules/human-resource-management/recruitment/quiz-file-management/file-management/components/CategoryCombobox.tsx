"use client";

import * as React from "react";
import { Check, ChevronsUpDown, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useFileManagementFetchContext } from "../providers/fetchProvider";

export function CategoryCombobox({
    value,
    onChange,
}: {
    value: string;
    onChange: (next: string) => void;
}) {
    const { allQuestions } = useFileManagementFetchContext();
    const [open, setOpen] = React.useState(false);
    const [search, setSearch] = React.useState("");

    const options = React.useMemo(() => {
        const set = new Set<string>();
        allQuestions.forEach((q) => {
            if (q.category) set.add(q.category);
        });
        return Array.from(set).sort((a, b) => a.localeCompare(b));
    }, [allQuestions]);

    const typed = search.trim();
    const canCreate = typed !== "" && !options.some((o) => o.toLowerCase() === typed.toLowerCase());

    const choose = (next: string) => {
        onChange(next);
        setSearch("");
        setOpen(false);
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <div className="flex gap-2">
                <PopoverTrigger asChild>
                    <Button
                        type="button"
                        variant="outline"
                        role="combobox"
                        aria-expanded={open}
                        className={cn("w-full justify-between font-normal", !value && "text-muted-foreground")}
                    >
                        <span className="truncate">{value || "Select or add a category"}</span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                </PopoverTrigger>
                {value && (
                    <Button type="button" variant="ghost" size="icon" aria-label="Clear category" onClick={() => onChange("")}>
                        <X className="h-4 w-4" />
                    </Button>
                )}
            </div>
            {/* Popover content is portalled outside the modal dialog, whose scroll-lock swallows wheel/touch events; stop them here so the list scrolls. */}
            <PopoverContent
                className="w-[--radix-popover-trigger-width] min-w-[260px] p-0"
                align="start"
                onWheel={(e) => e.stopPropagation()}
                onTouchMove={(e) => e.stopPropagation()}
            >
                <Command>
                    <CommandInput placeholder="Search or type a new category..." value={search} onValueChange={setSearch} />
                    <CommandList>
                        <CommandEmpty>{canCreate ? null : "No categories yet. Type to add one."}</CommandEmpty>
                        <CommandGroup>
                            {options.map((option) => (
                                <CommandItem key={option} value={option} onSelect={() => choose(option)}>
                                    <Check className={cn("mr-2 h-4 w-4", option === value ? "opacity-100" : "opacity-0")} />
                                    {option}
                                </CommandItem>
                            ))}
                            {canCreate && (
                                <CommandItem value={`__create__${typed}`} onSelect={() => choose(typed)}>
                                    <Plus className="mr-2 h-4 w-4" />
                                    Add &ldquo;{typed}&rdquo;
                                </CommandItem>
                            )}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}
