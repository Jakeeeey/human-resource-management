"use client";

import React from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";

// A presentational wrapper around a react-hook-form field array (the
// useFieldArray call itself stays in the section component, which passes its
// `fields`/append/remove down here -- this just standardizes the add/remove
// row chrome so the 6+ repeating sections don't each redraw it).
interface RepeatingFieldArrayProps<T extends { id: string }> {
    title: string;
    description?: string;
    addLabel: string;
    fields: T[];
    onAdd: () => void;
    onRemove: (index: number) => void;
    emptyHint?: string;
    renderRow: (index: number) => React.ReactNode;
}

export function RepeatingFieldArray<T extends { id: string }>({
    title,
    description,
    addLabel,
    fields,
    onAdd,
    onRemove,
    emptyHint,
    renderRow,
}: RepeatingFieldArrayProps<T>) {
    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
                <div>
                    <h3 className="text-sm font-semibold">{title}</h3>
                    {description && <p className="text-xs text-muted-foreground">{description}</p>}
                </div>
                <Button type="button" variant="outline" size="sm" onClick={onAdd}>
                    <Plus className="mr-1 h-3.5 w-3.5" />
                    {addLabel}
                </Button>
            </div>

            {fields.length === 0 && emptyHint && (
                <p className="text-sm text-muted-foreground">{emptyHint}</p>
            )}

            <div className="space-y-3">
                {fields.map((field, index) => (
                    <div key={field.id} className="relative rounded-lg border p-3">
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute right-2 top-2 h-7 w-7 text-muted-foreground"
                            onClick={() => onRemove(index)}
                        >
                            <X className="h-4 w-4" />
                            <span className="sr-only">Remove</span>
                        </Button>
                        <div className="grid gap-3 pr-8 sm:grid-cols-2">{renderRow(index)}</div>
                    </div>
                ))}
            </div>
        </div>
    );
}
