import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
    getDesign,
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

// Single-template routes (T4). GET reads one ms_templates row by numeric id
// (or template_key) via design-persistence getDesign (filter-based — dodges
// the Directus missing-single-item 403 gotcha); missing row → 404 with the
// old "Mail template not found" message. PATCH updates by path id with
// COMPILE-ON-UPDATE: whenever design_json is present it is recompiled
// (compileCanvasDoc) before saveDesign persists the row + compiled bodies.
// Envelope { success, data?, message?, errors? } mirrors the old
// api/hrm/mailing/templates/[id] route (READ-ONLY reference).

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
 * Compile-on-update: parses the stringified canvas doc and compiles it to
 * final email HTML (+ plaintext) with honest degradation warnings.
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
 * Resolves the path id to a getDesign ref: pure digits → numeric row id,
 * anything else → template_key.
 * @param raw - Path segment from [id].
 * @returns Numeric id or template_key ref.
 */
function toRef(raw: string): string | number {
    const trimmed = raw.trim();
    return /^\d+$/.test(trimmed) ? Number(trimmed) : trimmed;
}

/**
 * Fetches one ms_templates row by path id.
 * @param _req - Unused request (id comes from the path).
 * @param params - Route params carrying the template id.
 * @returns 200 { success:true, data } envelope; 400 on missing id, 404 when gone.
 */
export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        if (!id || id.trim() === "") {
            return validationFailed({ id: ["Template id is required"] });
        }

        let row: MsDesignRow | null;
        try {
            row = await getDesign(toRef(id));
        } catch (error) {
            return unexpected("[mailing-studio-templates] GET by id error:", error);
        }
        if (!row) {
            return NextResponse.json(
                { success: false, message: "Mail template not found" },
                { status: 404 }
            );
        }
        return NextResponse.json({ success: true, data: row });
    } catch (error) {
        return unexpected("[mailing-studio-templates] GET by id error:", error);
    }
}

/**
 * Updates one ms_templates row by path id (compile-on-update when
 * design_json changes); returns the verified row from saveDesign.
 * @param req - Request with the partial template JSON body.
 * @param params - Route params carrying the template id (body id is ignored).
 * @returns 200 { success:true, data }; 400 validation/export/save, 404 missing.
 */
export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        if (!id || id.trim() === "") {
            return validationFailed({ id: ["Template id is required"] });
        }

        const body: unknown = await req.json().catch(() => null);
        if (typeof body !== "object" || body === null || Array.isArray(body)) {
            return validationFailed({ _body: ["Request body must be a JSON object"] });
        }
        const record = { ...(body as Record<string, unknown>) };
        delete record.id;
        delete record._id;
        // created_at is immutable — never rewritten by PATCH.
        delete record.created_at;

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

        let existing: MsDesignRow | null;
        try {
            existing = await getDesign(toRef(id));
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
