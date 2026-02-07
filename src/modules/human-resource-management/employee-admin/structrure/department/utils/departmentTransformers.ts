/**
 * Department Data Transformers
 * Pure utilities only — NO runtime filtering
 */

import type { Department, Division } from "../types";

// ============================================================================
// GENERIC BASE TYPE
// ============================================================================

type HasDivision = { division?: Division | null };
type HasDate = { date_added: string };

// ============================================================================
// JOIN OPERATIONS
// ============================================================================

export function joinDepartmentsWithDivisions<T extends Department>(
    departments: T[],
    divisions: Division[]
): (T & { division: Division | null })[] {
    const divisionMap = new Map<number, Division>(
        divisions.map((d) => [d.division_id, d])
    );

    return departments.map((dept) => ({
        ...dept,
        division: divisionMap.get(dept.parent_division) ?? null,
    }));
}

// ============================================================================
// FORMATTERS
// ============================================================================

export function formatDate(dateString: string): string {
    if (!dateString) return "";
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "";
    return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
    });
}

export function formatMonthYear(dateString: string): string {
    if (!dateString) return "";
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "";
    return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
    });
}

export function truncateText(text: string, maxLength: number): string {
    if (!text) return "";
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength) + "...";
}

// ============================================================================
// GROUPING (SAFE GENERIC)
// ============================================================================

export function groupByDivision<T extends HasDivision>(
    departments: T[]
): Map<string, T[]> {
    const grouped = new Map<string, T[]>();

    for (const dept of departments) {
        const key = dept.division?.division_name ?? "Unknown";
        if (!grouped.has(key)) grouped.set(key, []);
        grouped.get(key)!.push(dept);
    }

    return grouped;
}

export function groupByMonth<T extends HasDate>(
    departments: T[]
): Map<string, T[]> {
    const grouped = new Map<string, T[]>();

    for (const dept of departments) {
        const date = new Date(dept.date_added);
        if (isNaN(date.getTime())) continue;

        const key = `${date.getFullYear()}-${String(
            date.getMonth() + 1
        ).padStart(2, "0")}`;

        if (!grouped.has(key)) grouped.set(key, []);
        grouped.get(key)!.push(dept);
    }

    return grouped;
}
