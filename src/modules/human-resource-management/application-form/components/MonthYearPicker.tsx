"use client";

import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { phToday } from "@/lib/time";

const MONTHS = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
];

const YEARS_BACK = 60;

export function MonthYearPicker({
    value,
    onChange,
    onBlur,
    disabled,
    "aria-label": ariaLabel,
}: {
    value: string;
    onChange: (next: string) => void;
    onBlur?: () => void;
    disabled?: boolean;
    "aria-label"?: string;
}) {
    const match = /^(\d{4})-(\d{2})$/.exec(value ?? "");
    const year = match ? match[1] : "";
    const month = match ? match[2] : "";

    const thisYear = Number(phToday().slice(0, 4));
    const years = Array.from({ length: YEARS_BACK + 1 }, (_, i) => String(thisYear - i));
    if (year && !years.includes(year)) years.push(year);

    const emit = (nextYear: string, nextMonth: string) => onChange(`${nextYear}-${nextMonth}`);

    if (value && !match) {
        return (
            <Input
                readOnly
                value={value}
                aria-label={ariaLabel}
                title="Entered as free text before the month and year lists were added"
            />
        );
    }

    return (
        <div className="grid grid-cols-2 gap-2" role="group" aria-label={ariaLabel}>
            <Select
                disabled={disabled}
                value={month}
                onValueChange={(m) => {
                    emit(year || String(thisYear), m);
                    onBlur?.();
                }}
            >
                <SelectTrigger aria-label={`${ariaLabel ?? "Date"} month`}>
                    <SelectValue placeholder="Month" />
                </SelectTrigger>
                <SelectContent>
                    {MONTHS.map((name, i) => (
                        <SelectItem key={name} value={String(i + 1).padStart(2, "0")}>
                            {name}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
            <Select
                disabled={disabled}
                value={year}
                onValueChange={(y) => {
                    emit(y, month || "01");
                    onBlur?.();
                }}
            >
                <SelectTrigger aria-label={`${ariaLabel ?? "Date"} year`}>
                    <SelectValue placeholder="Year" />
                </SelectTrigger>
                <SelectContent>
                    {years.map((y) => (
                        <SelectItem key={y} value={y}>
                            {y}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    );
}
