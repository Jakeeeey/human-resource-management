import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { dFetch } from "@/modules/human-resource-management/shared/utils/directus";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Applicant email lookup for compose autofill (the applicants list shape
// carries no email — the Send tab fills the recipient input from here on
// applicant select; the field stays editable and the send path still falls
// back to the application record when blank).
//
// Read-only: no auth gate by design would leak PII — so this route answers
// `{ email: null }` (never the address) unless the address passes validation,
// and the response carries ONLY the single resolved address, never a list.
// Never throws: unexpected failures answer a 500 envelope.

const applicantEmailQuerySchema = z.object({
    application_id: z.string().min(1),
});

const emailSchema = z.string().email();

// GET /api/hrm/mailing/applicant-email?application_id=<id> — resolve one
// application record email. Unknown id or invalid email → `{ email: null }`.
export async function GET(req: NextRequest) {
    try {
        const validation = applicantEmailQuerySchema.safeParse({
            application_id: req.nextUrl.searchParams.get("application_id") ?? "",
        });
        if (!validation.success) {
            return NextResponse.json(
                { success: false, message: "Validation failed", errors: validation.error.flatten().fieldErrors },
                { status: 400 }
            );
        }

        const lookup = (await dFetch(
            `/items/application?filter[id][_eq]=${encodeURIComponent(validation.data.application_id)}&fields=id,email&limit=1`
        )) as { data?: { email?: unknown }[] };
        const raw = Array.isArray(lookup?.data) ? lookup.data[0]?.email : undefined;
        const parsed = typeof raw === "string" ? emailSchema.safeParse(raw.trim()) : null;

        return NextResponse.json({
            success: true,
            data: { email: parsed && parsed.success ? parsed.data : null },
        });
    } catch (error) {
        console.error("[mailing-applicant-email] lookup error:", error);
        return NextResponse.json(
            { success: false, message: "An unexpected error occurred. Please try again later." },
            { status: 500 }
        );
    }
}
