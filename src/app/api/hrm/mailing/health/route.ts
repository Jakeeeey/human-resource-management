import { NextResponse } from "next/server";
import {
    getMailConfigStatus,
    getMailTransport,
    logRedacted,
} from "@/modules/human-resource-management/recruitment/mailing/providers/mailTransport";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/hrm/mailing/health
//
// Verify-only mail health probe: asserts MAIL_* env NAMES are present and runs
// transport `verify()`. Sends nothing, ever — no sendMail call exists on this
// path. Never returns 500 and never includes env VALUES (names only).
// No Zod here: GET with no body, nothing to validate.

export async function GET() {
    try {
        const status = getMailConfigStatus();
        const base = { dryRun: status.dryRun, ratePerMinute: status.ratePerMinute };

        if (!status.configured) {
            return NextResponse.json({
                success: true,
                data: { ok: false, degraded: true, ...base },
            });
        }

        try {
            await getMailTransport();
            return NextResponse.json({
                success: true,
                data: { ok: true, degraded: false, ...base },
            });
        } catch (error) {
            logRedacted("[mailing-health] transport verify failed:", error);
            return NextResponse.json({
                success: true,
                data: { ok: false, degraded: true, ...base },
            });
        }
    } catch (error) {
        logRedacted("[mailing-health] unexpected error:", error);
        return NextResponse.json({
            success: true,
            data: { ok: false, degraded: true, dryRun: true, ratePerMinute: 20 },
        });
    }
}
