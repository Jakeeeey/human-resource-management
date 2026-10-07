export const CONDITION_OPERATORS = [
  "equals",
  "not_equals",
  "in",
  "not_in",
  "is_set",
  "is_empty",
] as const;

export type ConditionOperator = (typeof CONDITION_OPERATORS)[number];

export interface Condition {
  field: string;
  op: ConditionOperator;
  value?: unknown;
}

export interface RoutableBinding {
  id: string | number;
  template_id: string | number;
  is_enabled: unknown;
  conditions: unknown;
  priority: unknown;
}

export interface RoutingResult {
  binding: RoutableBinding | null;
  reason: "matched" | "no-match";
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

function hasPresentField(payload: Record<string, unknown>, field: string): boolean {
  return Object.prototype.hasOwnProperty.call(payload, field) && payload[field] !== undefined;
}

function isEmptyValue(value: unknown): boolean {
  if (value === null || value === undefined || value === "") return true;
  if (Array.isArray(value)) return value.length === 0;
  if (isRecord(value)) return Object.keys(value).length === 0;
  return false;
}

function containsValue(list: unknown[], target: unknown): boolean {
  return list.some((item) => item === target);
}

function isNumericPriority(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value);
}

function compareIds(left: string | number, right: string | number): number {
  if (typeof left === "number" && typeof right === "number") return left - right;
  const leftText = String(left);
  const rightText = String(right);
  if (leftText < rightText) return -1;
  if (leftText > rightText) return 1;
  return 0;
}

function valueMatchesType(declared: string, value: unknown): boolean {
  switch (declared) {
    case "string":
      return typeof value === "string";
    case "number":
      return typeof value === "number";
    case "integer":
      return typeof value === "number" && Number.isInteger(value);
    case "boolean":
      return typeof value === "boolean";
    case "array":
      return Array.isArray(value);
    case "object":
      return isRecord(value);
    default:
      return true;
  }
}

export function parseConditions(raw: unknown): Condition[] | null {
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

export function matchCondition(
  condition: Condition,
  payload: Record<string, unknown>,
): boolean {
  if (!isRecord(payload)) return condition.op === "is_empty";
  const present = hasPresentField(payload, condition.field);
  switch (condition.op) {
    case "equals":
      return present && condition.value === payload[condition.field];
    case "not_equals":
      return present && condition.value !== payload[condition.field];
    case "in":
      return (
        present &&
        Array.isArray(condition.value) &&
        containsValue(condition.value, payload[condition.field])
      );
    case "not_in":
      return (
        present &&
        Array.isArray(condition.value) &&
        !containsValue(condition.value, payload[condition.field])
      );
    case "is_empty":
      return !present || isEmptyValue(payload[condition.field]);
    case "is_set":
      return present && !isEmptyValue(payload[condition.field]);
  }
}

export function sortEnabledBindings(
  bindings: readonly RoutableBinding[],
): RoutableBinding[] {
  return bindings
    .filter((entry) => Boolean(entry.is_enabled))
    .sort((left, right) => {
      const leftPriority = left.priority;
      const rightPriority = right.priority;
      const leftIsNumeric = isNumericPriority(leftPriority);
      const rightIsNumeric = isNumericPriority(rightPriority);
      if (leftIsNumeric && rightIsNumeric) {
        if (leftPriority !== rightPriority) return leftPriority - rightPriority;
      } else if (leftIsNumeric) {
        return -1;
      } else if (rightIsNumeric) {
        return 1;
      }
      return compareIds(left.id, right.id);
    });
}

export function evaluateRouting(
  bindings: readonly RoutableBinding[],
  payload: Record<string, unknown>,
): RoutingResult {
  const ordered = sortEnabledBindings(bindings);
  for (const entry of ordered) {
    const conditions = parseConditions(entry.conditions);
    if (conditions === null) continue;
    if (conditions.every((condition) => matchCondition(condition, payload))) {
      return { binding: entry, reason: "matched" };
    }
  }
  return { binding: null, reason: "no-match" };
}

export function extractConditionFields(
  schema: unknown,
): { name: string; type: string }[] {
  if (!isRecord(schema)) return [];
  if (!isRecord(schema.properties)) return [];
  const properties = schema.properties;
  const fields: { name: string; type: string }[] = [];
  for (const name of Object.keys(properties)) {
    const definition = properties[name];
    const type =
      isRecord(definition) && typeof definition.type === "string"
        ? definition.type
        : "string";
    fields.push({ name, type });
  }
  return fields;
}

export function validateConditionsForSchema(
  schema: unknown,
  conditions: unknown,
): { ok: boolean; errors: Record<string, string[]> } {
  const errors: Record<string, string[]> = {};
  function addError(key: string, message: string): void {
    const list = errors[key];
    if (list === undefined) {
      errors[key] = [message];
    } else {
      list.push(message);
    }
  }
  let properties: Record<string, unknown> | null = null;
  if (isRecord(schema) && isRecord(schema.properties)) {
    properties = schema.properties;
  }
  if (!Array.isArray(conditions)) {
    addError("conditions", "conditions must be an array of condition records");
    return { ok: false, errors };
  }
  conditions.forEach((entry, index) => {
    if (!isRecord(entry)) {
      addError(String(index), `condition at index ${index} must be an object`);
      return;
    }
    const fieldLabel =
      typeof entry.field === "string" && entry.field !== "" ? entry.field : null;
    const key = fieldLabel === null ? String(index) : `${String(index)}.${fieldLabel}`;
    if (fieldLabel === null) {
      addError(key, `condition at index ${index} must carry a non-empty string field`);
      return;
    }
    const definition = properties === null ? undefined : properties[fieldLabel];
    if (!isRecord(definition)) {
      addError(key, `unknown field "${fieldLabel}"`);
      return;
    }
    if (!isConditionOperator(entry.op)) {
      addError(key, `unknown operator "${String(entry.op)}"`);
      return;
    }
    const declaredType =
      typeof definition.type === "string" ? definition.type : "string";
    if (entry.op === "is_set" || entry.op === "is_empty") {
      if ("value" in entry && entry.value !== undefined) {
        addError(key, `"${entry.op}" must not carry a value`);
      }
      return;
    }
    if (!("value" in entry) || entry.value === undefined) {
      addError(key, `"${entry.op}" must carry a value`);
      return;
    }
    if (entry.op === "in" || entry.op === "not_in") {
      if (!Array.isArray(entry.value)) {
        addError(key, `"${entry.op}" must carry an array value`);
        return;
      }
      if (entry.value.length === 0) {
        addError(key, `"${entry.op}" must carry a non-empty array value`);
        return;
      }
      for (const member of entry.value) {
        if (!valueMatchesType(declaredType, member)) {
          addError(key, `expected a ${declaredType} value`);
          return;
        }
      }
      return;
    }
    if (!valueMatchesType(declaredType, entry.value)) {
      addError(key, `expected a ${declaredType} value`);
    }
  });
  return { ok: Object.keys(errors).length === 0, errors };
}
