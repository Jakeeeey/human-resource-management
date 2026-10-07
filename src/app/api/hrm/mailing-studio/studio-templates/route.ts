import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
    getDesign,
    listDesigns,
    saveDesign,
    type MsDesignRow,
} from "@/modules/human-resource-management/mailing-studio/studio-templates/designer/services/design-persistence-service";
import { compileCanvasDoc } from "@/modules/human-resource-management/mailing-studio/studio-templates/designer/services/export-service";
import type { CanvasDoc } from "@/modules/human-resource-management/mailing-studio/studio-templates/designer/types/canvas-doc.schema";
import {
    MS_BODY_HTML_MAX,
    MS_DESIGN_JSON_MAX,
} from "@/modules/human-resource-management/mailing-studio/studio-bindings/events/types/ms-template.schema";
import { mailHtmlToText } from "@/modules/human-resource-management/mailing-studio/studio-bindings/events/utils/ms-mail-text";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Templates collection routes (T4). Envelope { success, data?, message?,
// errors? } mirrors the old api/hrm/mailing/templates routes (READ-ONLY
// reference). Delegates every read/write to services/design-persistence-
// service (saveDesign/getDesign/listDesigns — write-then-verify-read) and
// composes COMPILE-ON-SAVE via export-service: design_json is compiled
// (compileCanvasDoc → MJML → email HTML) BEFORE the save, persisting
// body_html/body_text from the export. A compile failure answers 400 with the
// export reason + warnings — never a half-saved template.
//
// GET: old ?is_active= list filter (invalid value → 400, byte-parity) plus the
// T10 designService ?template_key= single-row read (null data when absent).
// No DELETE by design (parity with the old templates route).

function validationFailed(errors: Record<string, string[]>) {
    return NextResponse.json(
        { success: false, message: "Validation failed", errors },
        { status: 400 }
    );
}

function unexpected(logScope: string, error: unknown) {
    console.error(logScope, error);
    return NextResponse.json(
        { success: false, message: "An unexpected error occurred. Please try again later." },
        { status: 500 }
    );
}

function toBool(value: unknown): boolean {
    return value === true || value === 1 || value === "1" || value === "true";
}

function isValidJson(value: string): boolean {
    try {
        JSON.parse(value);
        return true;
    } catch {
        return false;
    }
}

const designJsonSchema = z
    .string()
    .max(MS_DESIGN_JSON_MAX, `design_json must be at most ${MS_DESIGN_JSON_MAX} characters`)
    .refine(isValidJson, "design_json must be valid JSON");

const templateCreateSchema = z.object({
    id: z.union([z.number(), z.string()]).optional(),
    template_key: z.string().min(1, "Template key is required"),
    template_name: z.string().min(1, "Template name is required"),
    subject: z.string().min(1, "Subject is required"),
    design_json: designJsonSchema,
    is_active: z.boolean().optional(),
});

const templatePatchSchema = z.object({
    template_key: z.string().min(1, "Template key is required").optional(),
    template_name: z.string().min(1, "Template name is required").optional(),
    subject: z.string().min(1, "Subject is required").optional(),
    design_json: designJsonSchema.optional().nullable(),
    body_html: z
        .string()
        .min(1)
        .max(MS_BODY_HTML_MAX, `Body must be at most ${MS_BODY_HTML_MAX} characters`)
        .optional(),
    body_text: z.string().min(1).optional(),
    is_active: z.boolean().optional(),
});

type TemplatePatch = z.infer<typeof templatePatchSchema>;

interface CompiledDesign {
    body_html: string;
    body_text: string;
    warnings: string[];
}

/**
 * Compile-on-save/on-update: parses the stringified canvas doc and compiles
 * it to final email HTML (+ plaintext) with honest degradation warnings.
 * @param design_json - Stringified canvas doc (already Zod-validated JSON).
 * @param subject - Becomes the export document <title>.
 * @returns Compiled bodies + export warnings.
 * @throws Error with the export reason (e.g. "empty-canvas") on failure.
 */
async function compileDesign(design_json: string, subject: string): Promise<CompiledDesign> {
    const doc: unknown = JSON.parse(design_json);
    const result = await compileCanvasDoc(doc as CanvasDoc, { subject });
    return {
        body_html: result.html,
        body_text: mailHtmlToText(result.html),
        warnings: result.warnings,
    };
}

/**
 * Lists ms_templates rows, newest first, with the old ?is_active= filter.
 * @param req - Request carrying optional ?is_active= / ?template_key=.
 * @returns 200 { success:true, data } envelope; 400 on invalid filter values.
 */
export async function GET(req: NextRequest) {
    try {
        const templateKey = req.nextUrl.searchParams.get("template_key");
        if (templateKey !== null) {
            let row: MsDesignRow | null;
            try {
                row = await getDesign(templateKey);
            } catch (error) {
                if (error instanceof TypeError) {
                    return unexpected("[mailing-studio-templates] GET single error:", error);
                }
                const message =
                    error instanceof Error && error.message
                        ? error.message
                        : "Failed to read mail template";
                return NextResponse.json({ success: false, message }, { status: 400 });
            }
            return NextResponse.json({ success: true, data: row });
        }

        const raw = req.nextUrl.searchParams.get("is_active");
        let wantActive: boolean | null = null;
        if (raw !== null) {
            const value = raw.trim().toLowerCase();
            if (value === "true" || value === "1") {
                wantActive = true;
            } else if (value === "false" || value === "0") {
                wantActive = false;
            } else {
                return NextResponse.json(
                    { success: false, message: "Invalid is_active value. Expected true or false." },
                    { status: 400 }
                );
            }
        }

        let rows: MsDesignRow[];
        try {
            rows = await listDesigns();
        } catch (error) {
            if (error instanceof TypeError) {
                return unexpected("[mailing-studio-templates] GET list error:", error);
            }
            const message =
                error instanceof Error && error.message
                    ? error.message
                    : "Failed to list mail templates";
            return NextResponse.json({ success: false, message }, { status: 400 });
        }

        const data =
            wantActive === null
                ? rows
                : rows.filter((row) => toBool(row.is_active) === wantActive);
        return NextResponse.json({ success: true, data });
    } catch (error) {
        return unexpected("[mailing-studio-templates] GET error:", error);
    }
}

export async function POST(req: NextRequest) {
    try {
        const body: unknown = await req.json().catch(() => null);
        const parsed = templateCreateSchema.safeParse(body);
        if (!parsed.success) {
            return validationFailed(parsed.error.flatten().fieldErrors);
        }

        const rawId = parsed.data.id;
        const idText = rawId === undefined || rawId === null ? "" : String(rawId).trim();
        let target: MsDesignRow | null = null;
        if (idText !== "") {
            try {
                target = await getDesign(/^\d+$/.test(idText) ? Number(idText) : idText);
            } catch (error) {
                return unexpected("[mailing-studio-templates] POST lookup error:", error);
            }
            if (!target) {
                return NextResponse.json(
                    { success: false, message: "Mail template not found" },
                    { status: 404 }
                );
            }
            if (parsed.data.template_key !== target.template_key) {
                let holder: MsDesignRow | null;
                try {
                    holder = await getDesign(parsed.data.template_key);
                } catch (error) {
                    return unexpected("[mailing-studio-templates] POST lookup error:", error);
                }
                if (holder && String(holder.id) !== String(target.id)) {
                    const reason = `template_key "${parsed.data.template_key}" is already in use`;
                    return NextResponse.json(
                        { success: false, message: reason, errors: { template_key: [reason] } },
                        { status: 409 }
                    );
                }
            }
        }

        let compiled: CompiledDesign;
        try {
            compiled = await compileDesign(parsed.data.design_json, parsed.data.subject);
        } catch (error) {
            const reason =
                error instanceof Error && error.message ? error.message : "Export failed";
            return NextResponse.json(
                { success: false, message: reason, errors: { warnings: [] as string[] } },
                { status: 400 }
            );
        }

        try {
            const row = await saveDesign({
                ...(target ? { id: target.id } : {}),
                template_key: parsed.data.template_key,
                template_name: parsed.data.template_name,
                subject: parsed.data.subject,
                design_json: parsed.data.design_json,
                body_html: compiled.body_html,
                body_text: compiled.body_text,
                ...(parsed.data.is_active !== undefined
                    ? { is_active: parsed.data.is_active }
                    : {}),
            });
            return NextResponse.json({
                success: true,
                data: row,
                ...(compiled.warnings.length > 0
                    ? { message: compiled.warnings.join(" | ") }
                    : {}),
            });
        } catch (error) {
            console.error("[mailing-studio-templates] POST save error:", error);
            const reason =
                error instanceof Error && error.message
                    ? error.message
                    : "Failed to save mail template";
            if (reason.includes("already in use")) {
                return NextResponse.json(
                    { success: false, message: reason, errors: { template_key: [reason] } },
                    { status: 409 }
                );
            }
            return NextResponse.json(
                { success: false, message: reason, errors: { warnings: compiled.warnings } },
                { status: 400 }
            );
        }
    } catch (error) {
        return unexpected("[mailing-studio-templates] POST error:", error);
    }
}

/**
 * Updates an ms_templates row by body { id | _id, ...fields } after Zod-partial
 * validation; compile-on-update when design_json is present.
 * @param req - Request with { id, ...templateFields } JSON body.
 * @returns 200 { success:true, data } with the verified row; 400/404 otherwise.
 */
export async function PATCH(req: NextRequest) {
    try {
        const body: unknown = await req.json().catch(() => null);
        if (typeof body !== "object" || body === null || Array.isArray(body)) {
            return validationFailed({ _body: ["Request body must be a JSON object"] });
        }
        const record = { ...(body as Record<string, unknown>) };
        const idValue = record.id ?? record._id;
        delete record.id;
        delete record._id;
        // created_at is immutable — never rewritten by PATCH.
        delete record.created_at;
        if (typeof idValue !== "number" && typeof idValue !== "string") {
            return validationFailed({ id: ["Template id is required"] });
        }
        if (typeof idValue === "string" && idValue.trim() === "") {
            return validationFailed({ id: ["Template id is required"] });
        }

        const parsed = templatePatchSchema.safeParse(record);
        if (!parsed.success) {
            return validationFailed(parsed.error.flatten().fieldErrors);
        }
        const patch: TemplatePatch = parsed.data;
        if (Object.keys(patch).length === 0) {
            return NextResponse.json(
                { success: false, message: "No fields to update" },
                { status: 400 }
            );
        }

        const ref =
            typeof idValue === "number" || /^\d+$/.test(idValue.trim())
                ? Number(typeof idValue === "number" ? idValue : idValue.trim())
                : idValue.trim();
        let existing: MsDesignRow | null;
        try {
            existing = await getDesign(ref);
        } catch (error) {
            return unexpected("[mailing-studio-templates] PATCH lookup error:", error);
        }
        if (!existing) {
            return NextResponse.json(
                { success: false, message: "Mail template not found" },
                { status: 404 }
            );
        }

        const nextKey = patch.template_key ?? existing.template_key;
        if (nextKey !== existing.template_key) {
            let holder: MsDesignRow | null;
            try {
                holder = await getDesign(nextKey);
            } catch (error) {
                return unexpected("[mailing-studio-templates] PATCH lookup error:", error);
            }
            if (holder && String(holder.id) !== String(existing.id)) {
                const reason = `template_key "${nextKey}" is already in use`;
                return NextResponse.json(
                    { success: false, message: reason, errors: { template_key: [reason] } },
                    { status: 409 }
                );
            }
        }

        let compiled: CompiledDesign | null = null;
        if (patch.design_json != null) {
            const subject = patch.subject ?? existing.subject;
            try {
                compiled = await compileDesign(patch.design_json, subject);
            } catch (error) {
                const reason =
                    error instanceof Error && error.message ? error.message : "Export failed";
                return NextResponse.json(
                    { success: false, message: reason, errors: { warnings: [] as string[] } },
                    { status: 400 }
                );
            }
        }

        const designJson = patch.design_json ?? existing.design_json;
        if (typeof designJson !== "string" || designJson.length === 0) {
            return NextResponse.json(
                { success: false, message: "design_json is required" },
                { status: 400 }
            );
        }

        try {
            const row = await saveDesign({
                id: existing.id,
                template_key: nextKey,
                template_name: patch.template_name ?? existing.template_name,
                subject: patch.subject ?? existing.subject,
                design_json: designJson,
                body_html: compiled ? compiled.body_html : patch.body_html,
                body_text: compiled ? compiled.body_text : patch.body_text,
                ...(patch.is_active !== undefined ? { is_active: patch.is_active } : {}),
            });
            const warnings = compiled?.warnings ?? [];
            return NextResponse.json({
                success: true,
                data: row,
                ...(warnings.length > 0 ? { message: warnings.join(" | ") } : {}),
            });
        } catch (error) {
            console.error("[mailing-studio-templates] PATCH save error:", error);
            const reason =
                error instanceof Error && error.message
                    ? error.message
                    : "Failed to save mail template";
            if (reason.includes("already in use")) {
                return NextResponse.json(
                    { success: false, message: reason, errors: { template_key: [reason] } },
                    { status: 409 }
                );
            }
            return NextResponse.json(
                {
                    success: false,
                    message: reason,
                    errors: { warnings: compiled?.warnings ?? [] },
                },
                { status: 400 }
            );
        }
    } catch (error) {
        return unexpected("[mailing-studio-templates] PATCH error:", error);
    }
}
