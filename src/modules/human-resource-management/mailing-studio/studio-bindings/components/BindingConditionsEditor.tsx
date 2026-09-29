"use client";

import { useMemo, useRef, useState } from "react";
import { Plus, X } from "lucide-react";

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
import { cn } from "@/lib/utils";

import {
    CONDITION_OPERATORS,
    extractConditionFields,
    type Condition,
    type ConditionOperator,
} from "../events/utils/routing-conditions";
import { CONDITION_OPERATOR_LABELS } from "../utils/ms-condition-labels";
import { MsCombobox } from "./MsCombobox";

export interface BindingConditionsEditorProps {
    readonly conditions: Condition[] | null;
    readonly onChange: (next: Condition[]) => void;
    readonly payloadSchema: unknown;
    readonly disabled?: boolean;
}

const VALUELESS_OPERATORS: readonly ConditionOperator[] = ["is_set", "is_empty"];

function isValueless(op: ConditionOperator): boolean {
    return VALUELESS_OPERATORS.includes(op);
}

function defaultValueForType(type: string, list: boolean): unknown {
    if (list) return [];
    if (type === "boolean") return false;
    if (type === "integer" || type === "number") return 0;
    return "";
}

function coerceScalarText(text: string, type: string): unknown {
    const trimmed = text.trim();
    if (type === "boolean") {
        if (trimmed.toLowerCase() === "true") return true;
        if (trimmed.toLowerCase() === "false") return false;
        return trimmed;
    }
    if (type === "integer" || type === "number") {
        if (trimmed === "") return "";
        const numeric = Number(trimmed);
        return Number.isNaN(numeric) ? trimmed : numeric;
    }
    return text;
}

function parseListText(text: string, type: string): unknown[] {
    return text
        .split(",")
        .map((part) => part.trim())
        .filter((part) => part.length > 0)
        .map((part) => coerceScalarText(part, type));
}

function listToText(value: unknown): string {
    if (!Array.isArray(value)) return "";
    return value.map((entry) => String(entry)).join(", ");
}

function scalarToText(value: unknown): string {
    if (value === undefined || value === null) return "";
    if (typeof value === "string") return value;
    if (typeof value === "number" || typeof value === "boolean") return String(value);
    return Array.isArray(value) ? listToText(value) : JSON.stringify(value) ?? "";
}

interface ConditionValueTagsProps {
    readonly id: string;
    readonly value: unknown;
    readonly fieldType: string;
    readonly disabled: boolean;
    readonly placeholder: string;
    readonly onChange: (next: unknown[]) => void;
}

function ConditionValueTags({
    id,
    value,
    fieldType,
    disabled,
    placeholder,
    onChange,
}: ConditionValueTagsProps) {
    const [draft, setDraft] = useState("");
    const inputRef = useRef<HTMLInputElement>(null);
    const chips = useMemo(
        () => (Array.isArray(value) ? value.map((entry) => String(entry)) : []),
        [value],
    );

    function commitText(raw: string): void {
        const coerced = parseListText(raw, fieldType);
        if (coerced.length === 0) return;
        const current = Array.isArray(value) ? value : [];
        const seen = new Set(current.map((entry) => String(entry)));
        const additions = coerced.filter((entry) => {
            const key = String(entry);
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
        if (additions.length === 0) return;
        onChange([...current, ...additions]);
    }

    function commitDraft(): void {
        if (draft.trim() === "") return;
        commitText(draft);
        setDraft("");
    }

    function removeChip(position: number): void {
        const current = Array.isArray(value) ? value : [];
        onChange(current.filter((_, entryIndex) => entryIndex !== position));
    }

    return (
        <div
            className={cn(
                "flex min-h-8 w-full flex-wrap items-center gap-1 rounded-md border border-input bg-transparent px-2 py-1 text-xs shadow-xs transition-[color,box-shadow] outline-none focus-within:border-ring focus-within:ring-ring/50 focus-within:ring-[3px]",
                disabled && "pointer-events-none cursor-not-allowed opacity-50",
            )}
            onClick={() => inputRef.current?.focus()}
            onKeyDown={(event) => event.stopPropagation()}
        >
            {chips.map((chip, position) => (
                <span
                    className="inline-flex max-w-full items-center gap-1 rounded-full border bg-muted py-px pr-1 pl-2 text-xs text-muted-foreground"
                    key={`${chip}-${position}`}
                >
                    <span className="min-w-0 truncate" title={chip}>
                        {chip}
                    </span>
                    <button
                        aria-label={`Remove ${chip}`}
                        className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-muted-foreground/20 hover:text-foreground focus-visible:outline-none"
                        disabled={disabled}
                        type="button"
                        onClick={() => removeChip(position)}
                        onMouseDown={(event) => event.preventDefault()}
                    >
                        <X className="h-3 w-3" />
                    </button>
                </span>
            ))}
            <input
                aria-label="Add a value"
                className="min-w-24 flex-1 bg-transparent py-px outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
                disabled={disabled}
                id={id}
                inputMode={fieldType === "integer" || fieldType === "number" ? "decimal" : "text"}
                placeholder={chips.length === 0 ? placeholder : ""}
                ref={inputRef}
                type="text"
                value={draft}
                onBlur={commitDraft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === ",") {
                        event.preventDefault();
                        commitDraft();
                    } else if (event.key === "Backspace" && draft === "") {
                        const current = Array.isArray(value) ? value : [];
                        if (current.length > 0) onChange(current.slice(0, -1));
                    }
                }}
                onPaste={(event) => {
                    const pasted = event.clipboardData.getData("text");
                    if (!pasted.includes(",")) return;
                    event.preventDefault();
                    commitText(`${draft}${pasted}`);
                    setDraft("");
                }}
            />
        </div>
    );
}

export function BindingConditionsEditor({
    conditions,
    onChange,
    payloadSchema,
    disabled = false,
}: BindingConditionsEditorProps) {
    const fields = useMemo(() => extractConditionFields(payloadSchema), [payloadSchema]);

    const typeByField = useMemo(() => {
        const map = new Map<string, string>();
        for (const field of fields) map.set(field.name, field.type);
        return map;
    }, [fields]);

    const fieldOptions = useMemo(
        () => fields.map((field) => ({ value: field.name, label: `${field.name} (${field.type})` })),
        [fields],
    );

    const rows = conditions ?? [];

    function emit(next: Condition[]): void {
        onChange(next);
    }

    function handleAdd(): void {
        const fallbackField = fields[0]?.name ?? "";
        if (fallbackField === "") return;
        const fallbackType = typeByField.get(fallbackField) ?? "string";
        emit([
            ...rows,
            { field: fallbackField, op: "equals", value: defaultValueForType(fallbackType, false) },
        ]);
    }

    function handleRemove(index: number): void {
        emit(rows.filter((_, position) => position !== index));
    }

    function handleFieldChange(index: number, field: string): void {
        const type = typeByField.get(field) ?? "string";
        emit(
            rows.map((row, position) => {
                if (position !== index) return row;
                const list = row.op === "in" || row.op === "not_in";
                if (isValueless(row.op)) return { field, op: row.op };
                return { field, op: row.op, value: defaultValueForType(type, list) };
            }),
        );
    }

    function handleOperatorChange(index: number, op: ConditionOperator): void {
        emit(
            rows.map((row, position) => {
                if (position !== index) return row;
                if (isValueless(op)) return { field: row.field, op };
                const type = typeByField.get(row.field) ?? "string";
                const list = op === "in" || op === "not_in";
                return { field: row.field, op, value: defaultValueForType(type, list) };
            }),
        );
    }

    function handleValueChange(index: number, value: unknown): void {
        emit(
            rows.map((row, position) => {
                if (position !== index) return row;
                return { field: row.field, op: row.op, value };
            }),
        );
    }

    if (rows.length === 0) {
        return (
            <div className="flex flex-col gap-2">
                <p className="text-xs text-muted-foreground" role="status">
                    Always matches (no conditions) — use this as a catch-all.
                </p>
                <p className="text-[11px] leading-snug text-muted-foreground">
                    Add a condition to narrow this rule. When several conditions are set, all of
                    them must match for the rule to send.
                </p>
                <div>
                    <Button
                        className="min-h-11 md:min-h-0"
                        disabled={disabled || fields.length === 0}
                        size="sm"
                        type="button"
                        variant="outline"
                        onClick={handleAdd}
                    >
                        <Plus className="h-4 w-4" />
                        Add condition
                    </Button>
                </div>
                {fields.length === 0 ? (
                    <p className="text-[11px] leading-snug text-destructive" role="alert">
                        This event exposes no schema fields, so conditions cannot be added yet.
                    </p>
                ) : null}
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-2">
            <p className="text-[11px] leading-snug text-muted-foreground">
                All conditions must match for this rule to send.
            </p>
            <ul className="flex flex-col gap-2">
                {rows.map((row, index) => {
                    const fieldType = typeByField.get(row.field) ?? "string";
                    const list = row.op === "in" || row.op === "not_in";
                    const rowId = `binding-condition-${index}`;
                    return (
                        <li
                            className="flex flex-col gap-2 rounded-lg border bg-card p-2.5"
                            key={`${row.field}-${index}`}
                        >
                            <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
                                <div className="flex min-w-0 flex-col gap-1.5">
                                    <Label
                                        className="text-xs font-medium text-muted-foreground"
                                        htmlFor={`${rowId}-field`}
                                    >
                                        Field
                                    </Label>
                                    <MsCombobox
                                        disabled={disabled}
                                        emptyText="No schema fields."
                                        id={`${rowId}-field`}
                                        options={fieldOptions}
                                        placeholder="Select a field"
                                        searchPlaceholder="Search fields…"
                                        value={row.field}
                                        onValueChange={(next) => handleFieldChange(index, next)}
                                    />
                                </div>
                                <div className="flex min-w-0 flex-col gap-1.5">
                                    <Label
                                        className="text-xs font-medium text-muted-foreground"
                                        htmlFor={`${rowId}-operator`}
                                    >
                                        Condition
                                    </Label>
                                    <Select
                                        disabled={disabled}
                                        value={row.op}
                                        onValueChange={(next) =>
                                            handleOperatorChange(index, next as ConditionOperator)
                                        }
                                    >
                                        <SelectTrigger className="h-8 text-xs" id={`${rowId}-operator`}>
                                            <SelectValue placeholder="Select a condition" />
                                        </SelectTrigger>
                                        <SelectContent className="max-h-60">
                                            {CONDITION_OPERATORS.map((op) => (
                                                <SelectItem key={op} value={op}>
                                                    {CONDITION_OPERATOR_LABELS[op]}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="flex items-end">
                                    <Button
                                        aria-label={`Remove condition ${index + 1}`}
                                        className="h-8 w-8 shrink-0"
                                        disabled={disabled}
                                        size="icon"
                                        type="button"
                                        variant="ghost"
                                        onClick={() => handleRemove(index)}
                                    >
                                        <X className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                            {isValueless(row.op) ? null : (
                                <div className="flex min-w-0 flex-col gap-1.5">
                                    <Label
                                        className="text-xs font-medium text-muted-foreground"
                                        htmlFor={`${rowId}-value`}
                                    >
                                        Value
                                    </Label>
                                    {list ? (
                                        <ConditionValueTags
                                            disabled={disabled}
                                            fieldType={fieldType}
                                            id={`${rowId}-value`}
                                            placeholder={
                                                fieldType === "boolean"
                                                    ? "Type true or false, press Enter"
                                                    : fieldType === "integer" || fieldType === "number"
                                                      ? "Type a number, press Enter"
                                                      : "Type a value, press Enter"
                                            }
                                            value={row.value}
                                            onChange={(next) => handleValueChange(index, next)}
                                        />
                                    ) : fieldType === "boolean" ? (
                                        <Select
                                            disabled={disabled}
                                            value={String(row.value ?? "false")}
                                            onValueChange={(next) =>
                                                handleValueChange(index, next === "true")
                                            }
                                        >
                                            <SelectTrigger className="h-8 text-xs" id={`${rowId}-value`}>
                                                <SelectValue placeholder="Select a value" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="true">True</SelectItem>
                                                <SelectItem value="false">False</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    ) : fieldType === "integer" || fieldType === "number" ? (
                                        <Input
                                            className="h-8 text-xs"
                                            disabled={disabled}
                                            id={`${rowId}-value`}
                                            inputMode="decimal"
                                            placeholder="Enter a number"
                                            type="number"
                                            value={scalarToText(row.value)}
                                            onChange={(event) =>
                                                handleValueChange(
                                                    index,
                                                    coerceScalarText(event.target.value, fieldType),
                                                )
                                            }
                                        />
                                    ) : (
                                        <Input
                                            className="h-8 text-xs"
                                            disabled={disabled}
                                            id={`${rowId}-value`}
                                            placeholder="Enter a value"
                                            type="text"
                                            value={scalarToText(row.value)}
                                            onChange={(event) =>
                                                handleValueChange(
                                                    index,
                                                    coerceScalarText(event.target.value, fieldType),
                                                )
                                            }
                                        />
                                    )}
                                </div>
                            )}
                        </li>
                    );
                })}
            </ul>
            <div>
                <Button
                    className="min-h-11 md:min-h-0"
                    disabled={disabled || fields.length === 0}
                    size="sm"
                    type="button"
                    variant="outline"
                    onClick={handleAdd}
                >
                    <Plus className="h-4 w-4" />
                    Add condition
                </Button>
            </div>
        </div>
    );
}
