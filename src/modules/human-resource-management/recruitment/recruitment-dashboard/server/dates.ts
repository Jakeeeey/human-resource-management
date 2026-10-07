import type { StatusCount } from "../types";

export function norm(value: string | null | undefined): string | null {
    if (value === null || value === undefined) return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}

export function dayKey(value: string): string | null {
    const time = Date.parse(value);
    if (Number.isNaN(time)) return null;
    return new Date(time).toISOString().slice(0, 10);
}

export function parseTime(value: string | null | undefined): number | null {
    if (value === null || value === undefined) return null;
    const time = Date.parse(value);
    return Number.isNaN(time) ? null : time;
}

export function rate(numerator: number, denominator: number): number | null {
    if (denominator <= 0) return null;
    return Math.round((numerator / denominator) * 1000) / 10;
}

export function countWhere(rows: readonly StatusCount[], match: (status: string) => boolean): number {
    return rows.reduce((sum, row) => (match(row.status) ? sum + row.count : sum), 0);
}

export function truthyPassed(value: boolean | number | null | undefined): boolean | null {
    if (value === null || value === undefined) return null;
    if (typeof value === "boolean") return value;
    return value !== 0;
}
