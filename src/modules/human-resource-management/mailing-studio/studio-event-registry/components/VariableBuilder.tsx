"use client";

import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

import { MS_VARIABLE_TYPE_OPTIONS, type MsVariableRow } from "../types/ms-catalog.schema";

interface VariableBuilderProps {
    readonly rows: readonly MsVariableRow[];
    readonly onChange: (rows: MsVariableRow[]) => void;
    readonly idPrefix: string;
}

const EMPTY_ROW: MsVariableRow = { name: "", type: "untyped", example: "" };

export function VariableBuilder({ rows, onChange, idPrefix }: VariableBuilderProps) {
    const patchRow = (index: number, patch: Partial<MsVariableRow>): void => {
        onChange(rows.map((row, at) => (at === index ? { ...row, ...patch } : row)));
    };

    const addRow = (): void => {
        onChange([...rows, { ...EMPTY_ROW }]);
    };

    const removeRow = (index: number): void => {
        onChange(rows.filter((_, at) => at !== index));
    };

    return (
        <div className="flex flex-col gap-2">
            {rows.length === 0 ? (
                <p className="text-[11px] leading-snug text-muted-foreground">
                    No variables yet — add the first one below. Templates bound to
                    this event may only use the names listed here.
                </p>
            ) : null}
            <ul className="flex flex-col gap-2">
                {rows.map((row, index) => (
                    <li
                        className="grid gap-2 rounded-lg border p-2 sm:grid-cols-[1fr_130px_1fr_auto]"
                        key={`${idPrefix}-row-${index}`}
                    >
                        <div className="flex flex-col gap-1">
                            <Label
                                className="text-[11px] font-medium text-muted-foreground"
                                htmlFor={`${idPrefix}-name-${index}`}
                            >
                                Name <span className="text-destructive">*</span>
                            </Label>
                            <Input
                                className="h-8 font-mono text-xs"
                                id={`${idPrefix}-name-${index}`}
                                placeholder="employee_name"
                                spellCheck={false}
                                value={row.name}
                                onChange={(event) => patchRow(index, { name: event.target.value })}
                            />
                        </div>
                        <div className="flex flex-col gap-1">
                            <Label
                                className="text-[11px] font-medium text-muted-foreground"
                                htmlFor={`${idPrefix}-type-${index}`}
                            >
                                Type
                            </Label>
                            <Select
                                value={row.type}
                                onValueChange={(next) =>
                                    patchRow(index, { type: next as MsVariableRow["type"] })
                                }
                            >
                                <SelectTrigger
                                    className="h-8 w-full text-xs"
                                    id={`${idPrefix}-type-${index}`}
                                    size="sm"
                                >
                                    <SelectValue placeholder="Type" />
                                </SelectTrigger>
                                <SelectContent className="max-h-60">
                                    {MS_VARIABLE_TYPE_OPTIONS.map((option) => (
                                        <SelectItem key={option.value} value={option.value}>
                                            {option.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex flex-col gap-1">
                            <Label
                                className="text-[11px] font-medium text-muted-foreground"
                                htmlFor={`${idPrefix}-example-${index}`}
                            >
                                Example value
                            </Label>
                            <Input
                                className="h-8 text-xs tabular-nums"
                                id={`${idPrefix}-example-${index}`}
                                placeholder="Juan Dela Cruz"
                                spellCheck={false}
                                value={row.example}
                                onChange={(event) => patchRow(index, { example: event.target.value })}
                            />
                        </div>
                        <div className="flex items-end justify-end">
                            <Button
                                aria-label={`Remove variable ${index + 1}`}
                                className="h-8 w-8"
                                size="icon"
                                variant="ghost"
                                onClick={() => removeRow(index)}
                            >
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </div>
                    </li>
                ))}
            </ul>
            <div>
                <Button
                    aria-label="Add variable"
                    className="min-h-11 md:min-h-0"
                    size="sm"
                    variant="secondary"
                    onClick={addRow}
                >
                    <Plus className="h-4 w-4" />
                    Add variable
                </Button>
            </div>
        </div>
    );
}
