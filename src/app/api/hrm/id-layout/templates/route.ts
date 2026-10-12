import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { idDocSchema } from "@/modules/human-resource-management/id-layout/types/id-layout.schema";

import {
    coerceDesignInput,
    dFetch,
    directusMessage,
    ID_TEMPLATE_LIST_FIELDS,
    ID_TEMPLATES_COLLECTION,
    isRecord,
    nowUTC,
    parseDesignJson,
    readTemplateById,
    toFullRow,
    toListRow,
} from "./_lib/directus";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAGE_SIZE = 10;

const templateCreateSchema = z.object({
    name: z.string().trim().min(1).max(150),
    company_id: z.number().int().positive().nullish(),
    is_default: z.union([z.boolean(), z.literal(0), z.literal(1)]).nullish(),
    design_json: z.unknown(),
});

export async function GET(req: NextRequest) {
    try {
        const rawPage = req.nextUrl.searchParams.get("page");
        const page = rawPage === null || rawPage.trim() === "" ? 1 : Number(rawPage);
        if (!Number.isInteger(page) || page < 1) {
            return NextResponse.json({ message: "Invalid page" }, { status: 400 });
        }
        const body: unknown = await dFetch(
            `/items/${ID_TEMPLATES_COLLECTION}?fields=${ID_TEMPLATE_LIST_FIELDS}&sort=-updated_at&limit=${PAGE_SIZE}&page=${page}&meta=filter_count`
        );
        if (!isRecord(body) || !Array.isArray(body.data)) {
            return NextResponse.json(
                { message: directusMessage(body) ?? "Failed to list ID templates" },
                { status: 500 }
            );
        }
        const meta: unknown = body.meta;
        const total =
            isRecord(meta) && typeof meta.filter_count === "number"
                ? meta.filter_count
                : body.data.length;
        const data = body.data.filter(isRecord).map(toListRow);
        return NextResponse.json({ data, total, page });
    } catch (error) {
        console.error("[id-layout-templates] GET error:", error);
        return NextResponse.json({ message: "Failed to list ID templates" }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const raw: unknown = await req.json().catch(() => null);
        const parsed = templateCreateSchema.safeParse(raw);
        if (!parsed.success) {
            return NextResponse.json(
                { message: "Validation failed", errors: parsed.error.flatten().fieldErrors },
                { status: 400 }
            );
        }
        const design = idDocSchema.safeParse(coerceDesignInput(parsed.data.design_json));
        if (!design.success) {
            return NextResponse.json(
                { message: "Invalid design_json", errors: design.error.flatten().fieldErrors },
                { status: 400 }
            );
        }
        const now = nowUTC();
        const payload = {
            name: parsed.data.name,
            company_id: parsed.data.company_id ?? null,
            is_default: parsed.data.is_default ?? false,
            design_json: JSON.stringify(design.data),
            created_at: now,
            updated_at: now,
        };
        const written: unknown = await dFetch(`/items/${ID_TEMPLATES_COLLECTION}`, {
            method: "POST",
            body: JSON.stringify(payload),
        });
        if (!isRecord(written) || !isRecord(written.data)) {
            return NextResponse.json(
                { message: directusMessage(written) ?? "Failed to create ID template" },
                { status: 500 }
            );
        }
        const verified = await readTemplateById(written.data.id);
        if (!verified) {
            return NextResponse.json(
                { message: "ID template write not found on read-back" },
                { status: 500 }
            );
        }
        if (JSON.stringify(parseDesignJson(verified.design_json)) !== JSON.stringify(design.data)) {
            return NextResponse.json(
                { message: "design_json did not persist" },
                { status: 500 }
            );
        }
        return NextResponse.json(toFullRow(verified), { status: 201 });
    } catch (error) {
        console.error("[id-layout-templates] POST error:", error);
        return NextResponse.json({ message: "Failed to create ID template" }, { status: 500 });
    }
}
