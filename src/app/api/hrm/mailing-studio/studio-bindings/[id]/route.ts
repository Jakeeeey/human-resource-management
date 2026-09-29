import { NextRequest, NextResponse } from "next/server";
import { msBindingSchema } from "@/modules/human-resource-management/mailing-studio/studio-bindings/types/ms-binding.schema";
import { dFetch } from "@/modules/human-resource-management/shared/utils/directus";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COLLECTION = "/items/ms_bindings";
const CATALOG_COLLECTION = "/items/event_catalog";
const FIELDS = "id,event_key_id,template_id,is_enabled";

const BODY_KEYS = ["event_key_id", "template_id", "is_enabled"] as const;
type BodyKey = (typeof BODY_KEYS)[number];

function isBodyKey(key: string): key is BodyKey {
    return (BODY_KEYS as readonly string[]).includes(key);
}

function rejectSuspiciousPayload(body: unknown): Record<string, string[]> | null {
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
        return { _body: ["Request body must be a JSON object"] };
    }
    const errors: Record<string, string[]> = {};
    for (const key of Object.keys(body)) {
        if (key === "__proto__" || key === "constructor" || key === "prototype") {
            errors[key] = [`Forbidden field: ${key}`];
            continue;
        }
        if (!isBodyKey(key)) {
            errors[key] = [`Unknown field: ${key}`];
            continue;
        }
        const value = (body as Record<string, unknown>)[key];
        if (typeof value !== "string" && typeof value !== "number" && typeof value !== "boolean") {
            errors[key] = [`${key} must be a string, number, or boolean — objects are never accepted`];
        }
    }
    return Object.keys(errors).length > 0 ? errors : null;
}

function validationFailed(errors: Record<string, string[]>) {
    return NextResponse.json(
        { success: false, message: "Validation failed", errors },
        { status: 400 }
    );
}

async function isActiveCatalogId(eventKeyId: string | number): Promise<boolean> {
    const ref = String(eventKeyId);
    const res = (await dFetch(
        `${CATALOG_COLLECTION}?fields=id&filter[id][_eq]=${encodeURIComponent(ref)}&filter[is_active][_eq]=true&limit=1`
    )) as { data?: unknown[] };
    return Array.isArray(res?.data) && res.data.length > 0;
}

function unknownEventKeyId(event_key_id: string | number) {
    return NextResponse.json(
        { success: false, message: "UNKNOWN_EVENT_KEY", event_key_id },
        { status: 422 }
    );
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        if (!id || id.trim() === "") {
            return validationFailed({ id: ["Binding id is required"] });
        }
        const res = (await dFetch(
            `${COLLECTION}/${encodeURIComponent(id)}?fields=${FIELDS}`
        )) as { data?: unknown };
        if (!res?.data) {
            return NextResponse.json(
                { success: false, message: "Binding not found." },
                { status: 404 }
            );
        }
        return NextResponse.json({ success: true, data: res.data });
    } catch (error) {
        console.error("[mailing-studio-bindings] get-by-id error:", error);
        return NextResponse.json(
            { success: false, message: "An unexpected error occurred. Please try again later." },
            { status: 500 }
        );
    }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        if (!id || id.trim() === "") {
            return validationFailed({ id: ["Binding id is required"] });
        }
        const body: unknown = await req.json();
        const suspicious = rejectSuspiciousPayload(body);
        if (suspicious) return validationFailed(suspicious);
        if (Object.keys(body as Record<string, unknown>).length === 0) {
            return validationFailed({ _body: ["Nothing to update"] });
        }

        const validation = msBindingSchema.partial().safeParse(body);
        if (!validation.success) {
            return validationFailed(validation.error.flatten().fieldErrors);
        }

        if (
            validation.data.event_key_id !== undefined &&
            !(await isActiveCatalogId(validation.data.event_key_id))
        ) {
            return unknownEventKeyId(validation.data.event_key_id);
        }

        const res = (await dFetch(`${COLLECTION}/${encodeURIComponent(id)}`, {
            method: "PATCH",
            body: JSON.stringify(validation.data),
        })) as { data?: unknown };
        if (!res?.data) {
            return NextResponse.json(
                { success: false, message: "Binding not found." },
                { status: 404 }
            );
        }
        return NextResponse.json({ success: true, data: res.data });
    } catch (error) {
        console.error("[mailing-studio-bindings] update-by-id error:", error);
        return NextResponse.json(
            { success: false, message: "An unexpected error occurred. Please try again later." },
            { status: 500 }
        );
    }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        if (!id || id.trim() === "") {
            return validationFailed({ id: ["Binding id is required"] });
        }
        await dFetch(`${COLLECTION}/${encodeURIComponent(id)}`, { method: "DELETE" });
        return NextResponse.json({
            success: true,
            data: { id },
            message: "Binding unhooked.",
        });
    } catch (error) {
        console.error("[mailing-studio-bindings] delete-by-id error:", error);
        return NextResponse.json(
            { success: false, message: "An unexpected error occurred. Please try again later." },
            { status: 500 }
        );
    }
}
