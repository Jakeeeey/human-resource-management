import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { compileCanvasDoc } from "@/modules/human-resource-management/mailing-studio/services/export-service";
import type { CanvasDoc } from "@/modules/human-resource-management/mailing-studio/types/canvas-doc.schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Preview compile route: compiles an IN-MEMORY canvas doc (unsaved edits
// included) through the real export path (compileCanvasDoc → MJML → HTML)
// and returns the exact HTML the receiver would see. No persistence —
// never touches ms_templates or mail_outbox. Envelope mirrors the
// templates routes: { success, data?: { html, warnings }, message? }.

const previewSchema = z.object({
    design_json: z.string().min(1, "design_json is required"),
    subject: z.string().optional(),
});

/**
 * Compiles the posted canvas doc to receiver HTML without saving.
 * @param req - Request with { design_json, subject? } JSON body.
 * @returns 200 { success:true, data:{ html, warnings } }; 400 on bad input or
 * export failure (e.g. "empty-canvas").
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
            return NextResponse.json({
                success: true,
                data: { html: result.html, warnings: result.warnings },
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
