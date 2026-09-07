import { NextRequest, NextResponse } from "next/server";
import { mailTemplateSchema } from "@/modules/human-resource-management/recruitment/mailing/types/mail-template.schema";
import { assertMailableHtml } from "@/modules/human-resource-management/recruitment/mailing/utils/mailScrub";
import { dFetch } from "@/modules/human-resource-management/shared/utils/directus";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Templates collection routes (mailing-module plan todo 5, Appendix Paths row).
// GET lists mail_templates rows (?is_active= pass-through filter), POST creates
// a row, PATCH updates a row by body id. No DELETE here by design — unhook/
// removal is out of scope for templates; QA cleanup uses direct Directus calls.
// Every mutation is Zod-validated (mailTemplateSchema) AND server re-asserted
// with assertMailableHtml (string predicates only, no DOM in Node) BEFORE the
// Directus write. Uniform envelope: { success, data?, message? }.

const COLLECTION = "mail_templates";
const FIELDS =
    "id,template_key,template_name,subject,body_html,body_text,is_active,created_at,updated_at,updated_by";

/**
 * PH-time producer (conventions.md §6): MySQL-compatible 'YYYY-MM-DD HH:mm:ss'
 * wall time, never server default / UTC toISOString.
 * @returns Current Philippine time as a MySQL-compatible string.
 */
function getPhilippineTime(): string {
    return new Date().toLocaleString("sv-SE", { timeZone: "Asia/Manila" });
}

/**
 * Lists mail_templates rows, newest first.
 * @param req - Request carrying the optional ?is_active= filter.
 * @returns 200 { success:true, data } envelope; 400 on invalid filter values.
 */
export async function GET(req: NextRequest) {
    try {
        const raw = req.nextUrl.searchParams.get("is_active");
        let filter = "";
        if (raw !== null) {
            const value = raw.trim().toLowerCase();
            if (value === "true" || value === "1") {
                filter = "&filter[is_active][_eq]=true";
            } else if (value === "false" || value === "0") {
                filter = "&filter[is_active][_eq]=false";
            } else {
                return NextResponse.json(
                    { success: false, message: "Invalid is_active value. Expected true or false." },
                    { status: 400 }
                );
            }
        }

        const res = (await dFetch(
            `/items/${COLLECTION}?fields=${FIELDS}&sort=-updated_at&limit=-1${filter}`
        )) as { data?: unknown[]; errors?: { message?: string }[] };
        if (!Array.isArray(res?.data)) {
            const message = res?.errors?.[0]?.message ?? "Failed to list mail templates";
            return NextResponse.json({ success: false, message }, { status: 400 });
        }
        return NextResponse.json({ success: true, data: res.data });
    } catch (error) {
        console.error("[mailing-templates] GET error:", error);
        return NextResponse.json(
            { success: false, message: "An unexpected error occurred. Please try again later." },
            { status: 500 }
        );
    }
}

/**
 * Creates a mail_templates row after Zod + server HTML re-assert.
 * @param req - Request with the template JSON body.
 * @returns 200 { success:true, data } on create; 400 on validation/HTML rejects.
 */
export async function POST(req: NextRequest) {
    try {
        const body: unknown = await req.json();
        const parsed = mailTemplateSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Validation failed",
                    errors: parsed.error.flatten().fieldErrors,
                },
                { status: 400 }
            );
        }

        const reason = assertMailableHtml(parsed.data.body_html);
        if (reason) {
            return NextResponse.json({ success: false, message: reason }, { status: 400 });
        }

        const now = getPhilippineTime();
        const payload = {
            template_key: parsed.data.template_key,
            template_name: parsed.data.template_name,
            subject: parsed.data.subject,
            body_html: parsed.data.body_html,
            body_text: parsed.data.body_text,
            is_active: parsed.data.is_active,
            created_at: now,
            updated_at: now,
            updated_by:
                typeof parsed.data.updated_by === "string" ? parsed.data.updated_by : "",
        };

        const created = (await dFetch(`/items/${COLLECTION}`, {
            method: "POST",
            body: JSON.stringify(payload),
        })) as { data?: unknown; errors?: { message?: string }[] };
        if (!created?.data) {
            const message = created?.errors?.[0]?.message ?? "Failed to create mail template";
            return NextResponse.json({ success: false, message }, { status: 400 });
        }
        return NextResponse.json({ success: true, data: created.data });
    } catch (error) {
        console.error("[mailing-templates] POST error:", error);
        return NextResponse.json(
            { success: false, message: "An unexpected error occurred. Please try again later." },
            { status: 500 }
        );
    }
}

/**
 * Updates a mail_templates row by body id after Zod-partial + HTML re-assert.
 * @param req - Request with { id, ...templateFields } JSON body.
 * @returns 200 { success:true, data } with the verified row; 400/404 otherwise.
 */
export async function PATCH(req: NextRequest) {
    try {
        const body = (await req.json()) as { id?: unknown } & Record<string, unknown>;
        const { id, ...rest } = body;
        // created_at is immutable — never rewritten by PATCH.
        delete (rest as Record<string, unknown>).created_at;
        if (typeof id !== "number" && typeof id !== "string") {
            return NextResponse.json(
                { success: false, message: "Template id is required" },
                { status: 400 }
            );
        }

        const parsed = mailTemplateSchema.partial().safeParse(rest);
        if (!parsed.success) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Validation failed",
                    errors: parsed.error.flatten().fieldErrors,
                },
                { status: 400 }
            );
        }
        if (Object.keys(parsed.data).length === 0) {
            return NextResponse.json(
                { success: false, message: "No fields to update" },
                { status: 400 }
            );
        }

        if (parsed.data.body_html !== undefined) {
            const reason = assertMailableHtml(parsed.data.body_html);
            if (reason) {
                return NextResponse.json({ success: false, message: reason }, { status: 400 });
            }
        }

        const payload = {
            ...parsed.data,
            updated_at: getPhilippineTime(),
            updated_by:
                typeof parsed.data.updated_by === "string" ? parsed.data.updated_by : "",
        };

        const updated = (await dFetch(`/items/${COLLECTION}/${id}`, {
            method: "PATCH",
            body: JSON.stringify(payload),
        })) as { data?: unknown; errors?: { message?: string }[] };
        if (!updated?.data) {
            const message = updated?.errors?.[0]?.message ?? "Mail template not found";
            const status = /not found|doesn't exist|does not exist/i.test(message) ? 404 : 400;
            return NextResponse.json({ success: false, message }, { status });
        }

        // Write-then-verify-read: return the stored row, not the echo.
        const verified = (await dFetch(`/items/${COLLECTION}/${id}?fields=${FIELDS}`)) as {
            data?: unknown;
        };
        return NextResponse.json({ success: true, data: verified?.data ?? updated.data });
    } catch (error) {
        console.error("[mailing-templates] PATCH error:", error);
        return NextResponse.json(
            { success: false, message: "An unexpected error occurred. Please try again later." },
            { status: 500 }
        );
    }
}
