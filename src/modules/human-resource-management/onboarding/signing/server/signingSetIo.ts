import { z } from "zod";

import { dFetch } from "@/modules/human-resource-management/shared/utils/directus";

// signingSetIo.ts — generic Directus IO primitives for the signing-set
// creation hook (todo 10). Every response body is checked for the Directus
// `errors` key (`dFetch` never throws on non-2xx — it returns the parsed error
// body) and every row is re-parsed with a contract schema, so a failed write
// can never masquerade as success. One layer up, `signingSetRows.ts` names
// these primitives per collection.

export const SIGNING_SET_ERROR_CODES = {
  invalidInput: "SIGNING_SET_INVALID_INPUT",
  readFailed: "SIGNING_SET_READ_FAILED",
  writeFailed: "SIGNING_SET_WRITE_FAILED",
  stateNotEligible: "SIGNING_SET_STATE_NOT_ELIGIBLE",
} as const;

export const ActivePaperworkTemplateSchema = z.object({
  id: z.number().int().positive(),
  title: z.string(),
});

export type ActivePaperworkTemplate = z.infer<
  typeof ActivePaperworkTemplateSchema
>;

export function getPhilippineTime(): string {
  return new Date().toLocaleString("sv-SE", { timeZone: "Asia/Manila" });
}

function directusErrorText(body: unknown): string | null {
  const errors = (body as { errors?: unknown } | null | undefined)?.errors;
  if (!Array.isArray(errors) || errors.length === 0) return null;
  return errors
    .map((entry) =>
      typeof (entry as { message?: unknown })?.message === "string"
        ? (entry as { message: string }).message
        : JSON.stringify(entry)
    )
    .join("; ");
}

function parseRow<T>(schema: z.ZodType<T>, row: unknown, context: string): T {
  const parsed = schema.safeParse(row);
  if (!parsed.success) {
    throw new Error(
      `${SIGNING_SET_ERROR_CODES.readFailed}: ${context} row failed the record contract (${parsed.error.issues
        .map((issue) => `${issue.path.join(".") || "row"}: ${issue.message}`)
        .join("; ")})`
    );
  }
  return parsed.data;
}

export async function readList<T>(
  path: string,
  schema: z.ZodType<T>
): Promise<T[]> {
  const body: unknown = await dFetch(path);
  const errorText = directusErrorText(body);
  if (errorText) {
    throw new Error(
      `${SIGNING_SET_ERROR_CODES.readFailed}: GET ${path} was rejected (${errorText})`
    );
  }
  const rows = (body as { data?: unknown } | null | undefined)?.data;
  if (!Array.isArray(rows)) {
    throw new Error(
      `${SIGNING_SET_ERROR_CODES.readFailed}: GET ${path} returned no data array`
    );
  }
  return rows.map((row, index) => parseRow(schema, row, `${path} #${index}`));
}

export async function insertRow<T>(
  collection: string,
  payload: Record<string, unknown>,
  schema: z.ZodType<T>
): Promise<T> {
  const body: unknown = await dFetch(`/items/${collection}`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  const errorText = directusErrorText(body);
  if (errorText) {
    throw new Error(
      `${SIGNING_SET_ERROR_CODES.writeFailed}: inserting into ${collection} was rejected (${errorText})`
    );
  }
  return parseRow(
    schema,
    (body as { data?: unknown })?.data,
    `insert ${collection}`
  );
}

export async function insertRows<T>(
  collection: string,
  payloads: Record<string, unknown>[],
  schema: z.ZodType<T>
): Promise<T[]> {
  if (payloads.length === 0) return [];
  const body: unknown = await dFetch(`/items/${collection}`, {
    method: "POST",
    body: JSON.stringify(payloads),
  });
  const errorText = directusErrorText(body);
  if (errorText) {
    throw new Error(
      `${SIGNING_SET_ERROR_CODES.writeFailed}: inserting ${collection} batch was rejected (${errorText})`
    );
  }
  const rows = (body as { data?: unknown } | null | undefined)?.data;
  if (!Array.isArray(rows)) {
    throw new Error(
      `${SIGNING_SET_ERROR_CODES.writeFailed}: inserting ${collection} batch returned no data array`
    );
  }
  return rows.map((row, index) =>
    parseRow(schema, row, `insert ${collection} #${index}`)
  );
}

export async function patchRow<T>(
  collection: string,
  id: number,
  payload: Record<string, unknown>,
  schema: z.ZodType<T>
): Promise<T> {
  const body: unknown = await dFetch(`/items/${collection}/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  const errorText = directusErrorText(body);
  if (errorText) {
    throw new Error(
      `${SIGNING_SET_ERROR_CODES.writeFailed}: patching ${collection}/${id} was rejected (${errorText})`
    );
  }
  return parseRow(
    schema,
    (body as { data?: unknown })?.data,
    `patch ${collection}`
  );
}
