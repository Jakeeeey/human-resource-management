import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { compileCanvasDoc } from "@/modules/human-resource-management/mailing-studio/services/export-service";
import type { CanvasDoc } from "@/modules/human-resource-management/mailing-studio/types/canvas-doc.schema";
import { extractPayloadExample } from "@/modules/human-resource-management/mailing-studio/utils/ms-variables";
import { renderTemplate } from "@/modules/human-resource-management/mailing-studio/utils/template-render";
import { dFetch } from "@/modules/human-resource-management/shared/utils/directus";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Preview compile route: compiles an IN-MEMORY canvas doc (unsaved edits
// included) through the real export path (compileCanvasDoc → MJML → HTML)
// and returns the exact HTML the receiver would see. No persistence —
// never touches ms_templates or mail_outbox. Envelope mirrors the
// templates routes: { success, data?: { html, warnings, sampleKey }, message? }.
//
// Sample resolution (S3-02/S3-03): the caller sends the preview-level
// `event_key`; the route reads that event's `payload_example` from the
// catalog and renders `{{tokens}}` through the SAME open-substitution
// renderer the event dispatch path uses (dispatch-service renderTemplate),
// so unknown paths surface `unknown-var:<path>` warnings and render empty —
// the preview frame agrees with what a send would emit instead of leaking
// raw `{{token}}` syntax. When no event key is sent, or the catalog row
// cannot be read, the route degrades to the raw compiled HTML with
// sampleKey null and the client falls back to its own catalog read.

const CATALOG_COLLECTION = "/items/event_catalog";

const previewSchema = z.object({
    design_json: z.string().min(1, "design_json is required"),
    subject: z.string().optional(),
    event_key: z.string().min(1).optional(),
});

interface CatalogRead {
    data?: Array<Record<string, unknown>>;
}

/**
 * Reads one event's sample payload from the catalog for preview resolution.
 * @param eventKey - Catalog event key from the preview request.
 * @returns The sample payload record, or null when the row is unreadable.
 */
async function readSamplePayload(eventKey: string): Promise<Record<string, unknown> | null> {
    try {
        const answer = (await dFetch(
            `${CATALOG_COLLECTION}?fields=event_key,payload_schema,payload_example&filter[event_key][_eq]=${encodeURIComponent(eventKey)}&limit=1`,
        )) as CatalogRead;
        const row = Array.isArray(answer?.data) ? answer.data[0] : undefined;
        if (!row || row.event_key !== eventKey) return null;
        return extractPayloadExample(row.payload_example);
    } catch {
        return null;
    }
}

/**
 * Compiles the posted canvas doc to receiver HTML without saving.
 * @param req - Request with { design_json, subject?, event_key? } JSON body.
 * @returns 200 { success:true, data:{ html, warnings, sampleKey } }; 400 on
 * bad input or export failure (e.g. "empty-canvas").
 */
export async function POST(req: NextRequest) {
    try {
        const body: unknown = await req.json().catch(() => null);
        const parsed = previewSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { success: false, message: "Validation failed", errors: parsed.error.flatten().fieldErrors },
                { status: 400 },
            );
        }
        let doc: unknown;
        try {
            doc = JSON.parse(parsed.data.design_json);
        } catch {
            return NextResponse.json(
                { success: false, message: "design_json must be valid JSON" },
                { status: 400 },
            );
        }
        try {
            const result = await compileCanvasDoc(doc as CanvasDoc, {
                ...(parsed.data.subject ? { subject: parsed.data.subject } : {}),
            });
            if (!parsed.data.event_key) {
                return NextResponse.json({
                    success: true,
                    data: { html: result.html, warnings: result.warnings, sampleKey: null },
                });
            }
            const sample = await readSamplePayload(parsed.data.event_key);
            if (sample === null) {
                return NextResponse.json({
                    success: true,
                    data: { html: result.html, warnings: result.warnings, sampleKey: null },
                });
            }
            const rendered = renderTemplate(result.html, { payload: sample });
            return NextResponse.json({
                success: true,
                data: {
                    html: rendered.html,
                    warnings: [...result.warnings, ...rendered.warnings],
                    sampleKey: parsed.data.event_key,
                },
            });
        } catch (error) {
            const reason =
                error instanceof Error && error.message ? error.message : "Export failed";
            return NextResponse.json({ success: false, message: reason }, { status: 400 });
        }
    } catch (error) {
        console.error("[mailing-studio-preview] POST error:", error);
        return NextResponse.json(
            { success: false, message: "An unexpected error occurred. Please try again later." },
            { status: 500 },
        );
    }
}
