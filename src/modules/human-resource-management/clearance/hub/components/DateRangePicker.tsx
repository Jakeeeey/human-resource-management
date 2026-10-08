"use client";

import { useState } from "react";
import type { JSX } from "react";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import type { DateRange } from "react-day-picker";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";

function parseDateInput(value: string): Date | undefined {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
    if (!match) return undefined;
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const date = new Date(year, month - 1, day);
    if (
        date.getFullYear() !== year ||
        date.getMonth() !== month - 1 ||
        date.getDate() !== day
    ) {
        return undefined;
    }
    return date;
}

function toDateString(date: Date): string {
    return format(date, "yyyy-MM-dd");
}

function rangeLabel(from: Date | undefined, to: Date | undefined, placeholder: string): string {
    if (from && to) return `${format(from, "LLL dd, y")} - ${format(to, "LLL dd, y")}`;
    if (from) return format(from, "LLL dd, y");
    return placeholder;
}

export function DateRangePicker(props: {
    id?: string;
    from: string;
    to: string;
    onChange: (from: string, to: string) => void;
    placeholder?: string;
    disabled?: boolean;
}): JSX.Element {
    const {
        id,
        from,
        to,
        onChange,
        placeholder = "Pick a date range",
        disabled = false,
    } = props;
    const [open, setOpen] = useState(false);
    const parsedFrom = parseDateInput(from);
    const parsedTo = parseDateInput(to);
    const selected: DateRange | undefined =
        parsedFrom || parsedTo ? { from: parsedFrom, to: parsedTo } : undefined;
    const label = rangeLabel(parsedFrom, parsedTo, placeholder);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    id={id}
                    type="button"
                    variant="outline"
                    disabled={disabled}
                    aria-label="Filter by filed date range"
                    data-empty={!selected}
                    className={cn(
                        "min-h-11 w-full justify-start text-left font-normal data-[empty=true]:text-muted-foreground sm:w-64 md:min-h-0"
                    )}
                >
                    <CalendarIcon className="mr-2 h-4 w-4 shrink-0" aria-hidden="true" />
                    <span className="truncate tabular-nums" title={label}>
                        {label}
                    </span>
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                    mode="range"
                    selected={selected}
                    onSelect={(range) => {
                        onChange(
                            range?.from ? toDateString(range.from) : "",
                            range?.to ? toDateString(range.to) : ""
                        );
                    }}
                    numberOfMonths={2}
                    initialFocus
                />
                {selected ? (
                    <div className="border-t border-border p-2">
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="w-full"
                            onClick={() => {
                                onChange("", "");
                            }}
                        >
                            Clear dates
                        </Button>
                    </div>
                ) : null}
            </PopoverContent>
        </Popover>
    );
}
