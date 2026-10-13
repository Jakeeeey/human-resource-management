import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { idDocSchema } from "@/modules/human-resource-management/id-layout/types/id-layout.schema";

import {
    clearOtherDefaultTemplates,
    coerceDesignInput,
    dFetch,
    directusMessage,
    idTemplateUniqueMessage,
    ID_TEMPLATES_COLLECTION,
    isRecord,
    isTruthyFlag,
    nowUTC,
    parseDesignJson,
    readTemplateById,
    toFullRow,
} from "../_lib/directus";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const templatePatchSchema = z.object({
    name: z.string().trim().min(1).max(150).optional(),
    company_id: z.number().int().positive().nullable().optional(),
    is_default: z.union([z.boolean(), z.literal(0), z.literal(1)]).optional(),
    is_active: z.union([z.boolean(), z.literal(0), z.literal(1)]).optional(),
    design_json: z.unknown().optional(),
});

export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const row = await readTemplateById(id);
        if (!row) {
            return NextResponse.json({ message: "ID template not found" }, { status: 404 });
        }
        return NextResponse.json(toFullRow(row));
    } catch (error) {
        console.error("[id-layout-templates] GET by id error:", error);
        return NextResponse.json({ message: "Failed to read ID template" }, { status: 500 });
    }
}

export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const raw: unknown = await req.json().catch(() => null);
        if (!isRecord(raw)) {
            return NextResponse.json(
                {
                    message: "Validation failed",
                    errors: { _body: ["Request body must be a JSON object"] },
                },
                { status: 400 }
            );
        }
        const record = { ...raw };
        delete record.id;
        delete record._id;
        delete record.created_at;
        const parsed = templatePatchSchema.safeParse(record);
        if (!parsed.success) {
            return NextResponse.json(
                { message: "Validation failed", errors: parsed.error.flatten().fieldErrors },
                { status: 400 }
            );
        }
        if (Object.keys(parsed.data).length === 0) {
            return NextResponse.json({ message: "No fields to update" }, { status: 400 });
        }
        let designJson: string | undefined;
        if (parsed.data.design_json !== undefined) {
            const design = idDocSchema.safeParse(coerceDesignInput(parsed.data.design_json));
            if (!design.success) {
                return NextResponse.json(
                    {
                        message: "Invalid design_json",
                        errors: design.error.flatten().fieldErrors,
                    },
                    { status: 400 }
                );
            }
            designJson = JSON.stringify(design.data);
        }
        const existing = await readTemplateById(id);
        if (!existing) {
            return NextResponse.json({ message: "ID template not found" }, { status: 404 });
        }
        const promoting = isTruthyFlag(parsed.data.is_default);
        if (promoting) {
            await clearOtherDefaultTemplates(existing.id);
        }
        const payload: Record<string, unknown> = { updated_at: nowUTC() };
        if (parsed.data.name !== undefined) {
            payload.name = parsed.data.name;
        }
        if (parsed.data.company_id !== undefined) {
            payload.company_id = parsed.data.company_id;
        }
        if (parsed.data.is_default !== undefined) {
            payload.is_default = promoting ? 1 : parsed.data.is_default;
        }
        if (parsed.data.is_active !== undefined) {
            payload.is_active = parsed.data.is_active;
        }
        if (promoting) {
            payload.is_active = 1;
        }
        if (designJson !== undefined) {
            payload.design_json = designJson;
        }
        const written: unknown = await dFetch(
            `/items/${ID_TEMPLATES_COLLECTION}/${String(existing.id)}`,
            { method: "PATCH", body: JSON.stringify(payload) }
        );
        if (!isRecord(written) || !isRecord(written.data)) {
            const uniqueMessage = idTemplateUniqueMessage(written);
            if (uniqueMessage !== null) {
                return NextResponse.json({ message: uniqueMessage }, { status: 409 });
            }
            return NextResponse.json(
                { message: directusMessage(written) ?? "Failed to update ID template" },
                { status: 500 }
            );
        }
        const verified = await readTemplateById(existing.id);
        if (!verified) {
            return NextResponse.json(
                { message: "ID template write not found on read-back" },
                { status: 500 }
            );
        }
        if (
            designJson !== undefined &&
            JSON.stringify(parseDesignJson(verified.design_json)) !== designJson
        ) {
            return NextResponse.json({ message: "design_json did not persist" }, { status: 500 });
        }
        return NextResponse.json(toFullRow(verified));
    } catch (error) {
        console.error("[id-layout-templates] PATCH error:", error);
        const uniqueMessage = idTemplateUniqueMessage(error);
        if (uniqueMessage !== null) {
            return NextResponse.json({ message: uniqueMessage }, { status: 409 });
        }
        return NextResponse.json({ message: "Failed to update ID template" }, { status: 500 });
    }
}

export async function DELETE(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const existing = await readTemplateById(id);
        if (!existing) {
            return NextResponse.json({ message: "ID template not found" }, { status: 404 });
        }
        await dFetch(`/items/${ID_TEMPLATES_COLLECTION}/${String(existing.id)}`, { method: "DELETE" });
        const verified = await readTemplateById(existing.id);
        if (verified) {
            return NextResponse.json({ message: "ID template was not removed" }, { status: 500 });
        }
        return new NextResponse(null, { status: 204 });
    } catch (error) {
        console.error("[id-layout-templates] DELETE error:", error);
        return NextResponse.json({ message: "Failed to delete ID template" }, { status: 500 });
    }
}
