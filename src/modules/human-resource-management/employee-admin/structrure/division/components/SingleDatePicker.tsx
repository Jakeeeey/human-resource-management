"use client";
import { Input } from "@/components/ui/input";

export function SingleDatePicker({ value, onChange, placeholder }: { value: Date | null | undefined, onChange: (date: Date | null) => void, placeholder?: string }) {
    return (
        <Input
            type="date"
            placeholder={placeholder}
            value={value ? value.toISOString().slice(0, 10) : ""}
            onChange={(e) =>
                onChange(e.target.value ? new Date(e.target.value) : null)
            }
        />
    );
}
