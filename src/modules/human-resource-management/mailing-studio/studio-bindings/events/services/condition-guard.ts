import { dFetch } from "@/modules/human-resource-management/mailing-studio/utils/directus";

import {
  parseConditions,
  validateConditionsForSchema,
} from "../utils/routing-conditions";
import { msLogRedacted } from "./mail-transport";

const EVENT_CATALOG_COLLECTION = "/items/event_catalog";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toActiveFlag(value: unknown): boolean {
  return value === true || value === 1 || value === "1" || value === "true";
}

function parseSchemaDocument(value: unknown): unknown | null {
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as unknown;
    } catch {
      return null;
    }
  }
  return value ?? null;
}

function stableSerialize(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableSerialize(item)).join(",")}]`;
  }
  if (isRecord(value)) {
    const parts = Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableSerialize(value[key])}`);
    return `{${parts.join(",")}}`;
  }
  const serialized = JSON.stringify(value);
  return typeof serialized === "string" ? serialized : "null";
}

export async function loadActiveEventSchemaById(
  eventKeyId: string | number,
): Promise<{ active: boolean; schema: unknown | null }> {
  const closed = { active: false, schema: null };
  try {
    const idText = String(eventKeyId).trim();
    if (idText === "") return closed;
    const res = (await dFetch(
      `${EVENT_CATALOG_COLLECTION}?fields=id,payload_schema,is_active&filter[id][_eq]=${encodeURIComponent(idText)}&limit=1`,
    )) as { data?: unknown[]; errors?: { message?: string }[] };
    if (Array.isArray(res?.errors) && res.errors.length > 0) return closed;
    const row = Array.isArray(res?.data) ? res.data[0] : undefined;
    if (!isRecord(row)) return closed;
    const active = toActiveFlag(row.is_active);
    if (!active) return closed;
    return { active: true, schema: parseSchemaDocument(row.payload_schema) };
  } catch (error) {
    msLogRedacted("[condition-guard] event schema lookup failed (failing closed):", error);
    return closed;
  }
}

export async function validateBindingConditionsById(
  eventKeyId: string | number,
  conditions: unknown,
): Promise<{ ok: boolean; errors: Record<string, string[]> }> {
  try {
    const loaded = await loadActiveEventSchemaById(eventKeyId);
    if (!loaded.active) {
      return {
        ok: false,
        errors: { event_key_id: ["event_key_id must reference an active event_catalog row"] },
      };
    }
    const parsed = parseConditions(conditions);
    if (parsed === null) {
      return {
        ok: false,
        errors: { conditions: ["conditions must be an array of condition records"] },
      };
    }
    if (parsed.length === 0) return { ok: true, errors: {} };
    return validateConditionsForSchema(loaded.schema, parsed);
  } catch (error) {
    msLogRedacted("[condition-guard] binding condition validation failed (failing closed):", error);
    return {
      ok: false,
      errors: { event_key_id: ["event_key_id must reference an active event_catalog row"] },
    };
  }
}

export function conditionsMatchReadback(expected: unknown, actual: unknown): boolean {
  const want = parseConditions(expected);
  if (want === null) return false;
  const got = parseConditions(actual);
  if (got === null) return false;
  if (want.length === 0) return got.length === 0;
  if (got.length === 0) return false;
  const normalise = (entry: { field: string; op: string; value?: unknown }) =>
    "value" in entry && entry.value !== undefined
      ? { field: entry.field, op: entry.op, value: entry.value }
      : { field: entry.field, op: entry.op };
  return stableSerialize(want.map(normalise)) === stableSerialize(got.map(normalise));
}
