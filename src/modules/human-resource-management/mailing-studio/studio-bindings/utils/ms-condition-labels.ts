const CONDITION_OPERATORS = [
    "equals",
    "not_equals",
    "in",
    "not_in",
    "is_set",
    "is_empty",
] as const;

type ConditionOperator = (typeof CONDITION_OPERATORS)[number];

interface Condition {
    field: string;
    op: ConditionOperator;
    value?: unknown;
}

export const CONDITION_OPERATOR_LABELS: Record<ConditionOperator, string> = {
    equals: "is",
    not_equals: "is not",
    in: "is one of",
    not_in: "is not one of",
    is_set: "has a value",
    is_empty: "is empty",
};

function formatValue(value: unknown): string {
    if (typeof value === "string") return `"${value}"`;
    if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
        return String(value);
    }
    if (value === null) return "null";
    if (value === undefined) return "unset";
    return String(value);
}

function formatList(value: unknown): string {
    if (!Array.isArray(value)) return "";
    return value.map(formatValue).join(", ");
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isConditionOperator(value: unknown): value is ConditionOperator {
    return (
        value === "equals" ||
        value === "not_equals" ||
        value === "in" ||
        value === "not_in" ||
        value === "is_set" ||
        value === "is_empty"
    );
}

function tryParseJson(text: string): { ok: boolean; value: unknown } {
    try {
        return { ok: true, value: JSON.parse(text) };
    } catch {
        return { ok: false, value: null };
    }
}

function parseConditions(raw: unknown): Condition[] | null {
    if (raw === null || raw === undefined || raw === "") return [];
    let candidate: unknown = raw;
    if (typeof candidate === "string") {
        const parsed = tryParseJson(candidate);
        if (!parsed.ok) return null;
        candidate = parsed.value;
        if (candidate === null) return [];
    }
    if (!Array.isArray(candidate)) return null;
    if (candidate.length === 0) return [];
    const out: Condition[] = [];
    for (const entry of candidate) {
        if (!isRecord(entry)) return null;
        if (typeof entry.field !== "string" || entry.field === "") return null;
        if (!isConditionOperator(entry.op)) return null;
        if (entry.op === "is_set" || entry.op === "is_empty") {
            if ("value" in entry && entry.value !== undefined) return null;
            out.push({ field: entry.field, op: entry.op });
            continue;
        }
        if (!("value" in entry) || entry.value === undefined) return null;
        if ((entry.op === "in" || entry.op === "not_in") && !Array.isArray(entry.value)) {
            return null;
        }
        out.push({ field: entry.field, op: entry.op, value: entry.value });
    }
    return out;
}

function summariseOne(condition: Condition): string {
    if (!CONDITION_OPERATORS.includes(condition.op)) return "Invalid rule";
    if (condition.op === "is_set") return `${condition.field} ${CONDITION_OPERATOR_LABELS.is_set}`;
    if (condition.op === "is_empty") return `${condition.field} ${CONDITION_OPERATOR_LABELS.is_empty}`;
    if (condition.op === "in")
        return `${condition.field} ${CONDITION_OPERATOR_LABELS.in} ${formatList(condition.value)}`;
    if (condition.op === "not_in")
        return `${condition.field} ${CONDITION_OPERATOR_LABELS.not_in} ${formatList(condition.value)}`;
    if (condition.op === "not_equals")
        return `${condition.field} ${CONDITION_OPERATOR_LABELS.not_equals} ${formatValue(condition.value)}`;
    if (condition.op === "equals")
        return `${condition.field} ${CONDITION_OPERATOR_LABELS.equals} ${formatValue(condition.value)}`;
    return "Invalid rule";
}

export function summariseConditions(conditions: Condition[] | null): string {
    try {
        const parsed = parseConditions(conditions);
        if (parsed === null) return "Invalid rule";
        if (parsed.length === 0) return "Always matches";
        return parsed.map(summariseOne).join(" and ");
    } catch {
        return "Invalid rule";
    }
}
