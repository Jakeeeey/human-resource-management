import { dFetch } from "@/modules/human-resource-management/shared/utils/directus";

import { MS_DESIGN_JSON_MAX } from "../types/ms-template.schema";
import { compileVariablesFromDesignJson, normaliseVariablesList } from "../utils/ms-variables";

// Mailing-studio design persistence (T10): direct ms_templates CRUD via shared
// dFetch. Server-side implementation — T4's /api/hrm/mailing-studio/templates
// handlers will call saveDesign/getDesign/listDesigns; T10 verifies the
// round-trip against live Directus from a bun probe (route does not exist yet).
// Directus gotcha: 200/{success:true} is NOT proof a write persisted (a PATCH
// naming an unknown column is silently discarded) — every mutation therefore
// does write-then-verify-read and returns the RE-READ row; design_json must be
// byte-identical or we throw.
// body_html/body_text are optional pass-throughs (compile-on-save lands with
// T4/T6 via export-service — out of scope here). Never touches mail_outbox.

const COLLECTION = "ms_templates";
const FIELDS =
    "id,template_key,template_name,subject,design_json,variables,body_html,body_text,is_active,created_at,updated_at";

export interface SaveDesignInput {
    template_key: string;
    template_name: string;
    subject: string;
    /** Stringified canvas doc ({version:1, width, nodes, rootIds}); ≤ MS_DESIGN_JSON_MAX, valid JSON. */
    design_json: string;
    body_html?: string | null;
    body_text?: string | null;
    is_active?: boolean;
}

export interface MsDesignRow {
    id: number | string;
    template_key: string;
    template_name: string;
    subject: string;
    design_json: string | null;
    /** Derived cache (§6.4): distinct {{ key }} tokens in design_json, bare form. Compiled on save, never hand-edited. */
    variables?: string[] | null;
    body_html?: string | null;
    body_text?: string | null;
    is_active?: boolean | number;
    created_at?: string | null;
    updated_at?: string | null;
}

interface DirectusEnvelope<T> {
    data?: T;
    errors?: { message?: string }[];
}

/**
 * PH-time producer (conventions): MySQL-compatible 'YYYY-MM-DD HH:mm:ss'
 * wall time, never server default / UTC toISOString.
 * @returns Current Philippine time as a MySQL-compatible string.
 */
function getPhilippineTime(): string {
    return new Date().toLocaleString("sv-SE", { timeZone: "Asia/Manila" });
}

/**
 * Validates design_json before any write: ≤ MS_DESIGN_JSON_MAX and parseable.
 * @param design_json - Stringified canvas doc.
 * @throws Error when the cap is exceeded or the payload is not valid JSON.
 */
function assertDesignJson(design_json: string): void {
    if (design_json.length > MS_DESIGN_JSON_MAX) {
        throw new Error(`design_json must be at most ${MS_DESIGN_JSON_MAX} characters`);
    }
    try {
        JSON.parse(design_json);
    } catch {
        throw new Error("design_json must be valid JSON");
    }
}

/**
 * Reads a single ms_templates row by numeric id OR template_key.
 * Uses ?filter= (never the /items/:id path) so a missing row is an empty
 * list → null, dodging Directus's missing-single-item 403 gotcha.
 * @param ref - Numeric row id or template_key string.
 * @returns The row, or null when absent.
 */
export async function getDesign(ref: string | number): Promise<MsDesignRow | null> {
    const filter =
        typeof ref === "number"
            ? `filter[id][_eq]=${String(ref)}`
            : `filter[template_key][_eq]=${encodeURIComponent(ref)}`;
    const res = (await dFetch(
        `/items/${COLLECTION}?fields=${FIELDS}&${filter}&limit=1`
    )) as DirectusEnvelope<MsDesignRow[]>;
    if (res?.errors?.length) {
        throw new Error(res.errors[0]?.message ?? "Failed to read ms_templates");
    }
    return res?.data?.[0] ?? null;
}

/**
 * Lists ms_templates rows, newest first (minimal field set).
 * @returns All rows in the collection.
 */
export async function listDesigns(): Promise<MsDesignRow[]> {
    const res = (await dFetch(
        `/items/${COLLECTION}?fields=${FIELDS}&sort=-updated_at&limit=-1`
    )) as DirectusEnvelope<MsDesignRow[]>;
    if (!Array.isArray(res?.data)) {
        throw new Error(res?.errors?.[0]?.message ?? "Failed to list ms_templates");
    }
    return res.data;
}

/**
 * Create-or-PATCH by template_key with write-then-verify-read.
 * body_html/body_text are written only when the caller passes them (undefined
 * = leave the stored value alone; null = clear). created_at is set on create
 * only and never rewritten by updates.
 * @param input - Template meta + stringified design_json (+ optional compiled bodies).
 * @returns The re-read row (design_json byte-identical to the input or throws).
 * @throws Error on validation failure, Directus errors, or verify mismatch.
 */
export async function saveDesign(input: SaveDesignInput): Promise<MsDesignRow> {
    const { template_key, template_name, subject, design_json } = input;
    if (!template_key?.trim()) throw new Error("Template key is required");
    if (!template_name?.trim()) throw new Error("Template name is required");
    if (!subject?.trim()) throw new Error("Subject is required");
    assertDesignJson(design_json);

    const now = getPhilippineTime();
    const existing = await getDesign(template_key);

    const variables = compileVariablesFromDesignJson(design_json);
    const payload: Record<string, unknown> = {
        template_key,
        template_name,
        subject,
        design_json,
        variables,
        updated_at: now,
    };
    if (input.body_html !== undefined) payload.body_html = input.body_html;
    if (input.body_text !== undefined) payload.body_text = input.body_text;
    if (input.is_active !== undefined) payload.is_active = input.is_active;

    const isUpdate = existing !== null && existing.id !== undefined && existing.id !== null;
    if (!isUpdate) payload.created_at = now;

    const written = (await dFetch(
        isUpdate ? `/items/${COLLECTION}/${String(existing.id)}` : `/items/${COLLECTION}`,
        { method: isUpdate ? "PATCH" : "POST", body: JSON.stringify(payload) }
    )) as DirectusEnvelope<MsDesignRow>;
    if (!written?.data) {
        throw new Error(written?.errors?.[0]?.message ?? "ms_templates write failed");
    }

    // write-then-verify-read: trust the re-read row, never the write echo.
    const verified = await getDesign(template_key);
    if (!verified) {
        throw new Error("ms_templates write not found on read-back");
    }
    if (verified.design_json !== design_json) {
        throw new Error("design_json did not persist (write-then-verify-read mismatch)");
    }
    const readBack = normaliseVariablesList(verified.variables);
    if (JSON.stringify(readBack) !== JSON.stringify([...variables].sort())) {
        throw new Error("variables did not persist (write-then-verify-read mismatch)");
    }
    return verified;
}
