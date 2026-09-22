import { NextResponse } from "next/server";
import {
    getMsMailConfigStatus,
    getMsMailTransport,
    msLogRedacted,
} from "@/modules/human-resource-management/mailing-studio/services/mail-transport";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/hrm/mailing-studio/health
//
// Verify-only mail health probe (READ-ONLY mirror of the old
// api/hrm/mailing/health route on the mailing-studio transport): asserts
// MAIL_* env NAMES are present via getMsMailConfigStatus (names only — never
// values) and, when configured, runs transport `verify()`. Sends nothing,
// ever — no sendMail call exists on this path. NEVER returns 500: every
// failure degrades to `{ ok:false, degraded:true }` inside the success
// envelope. No Zod here: GET with no body, nothing to validate.

export async function GET() {
    try {
        const status = getMsMailConfigStatus();
        const base = { dryRun: status.dryRun, ratePerMinute: status.ratePerMinute };

        if (!status.configured) {
            return NextResponse.json({
                success: true,
                data: { ok: false, degraded: true, ...base },
            });
        }

        try {
            await getMsMailTransport();
            return NextResponse.json({
                success: true,
                data: { ok: true, degraded: false, ...base },
            });
        } catch (error) {
            msLogRedacted("[mailing-studio-health] transport verify failed:", error);
            return NextResponse.json({
                success: true,
                data: { ok: false, degraded: true, ...base },
            });
        }
    } catch (error) {
        msLogRedacted("[mailing-studio-health] unexpected error:", error);
        return NextResponse.json({
            success: true,
            data: { ok: false, degraded: true, dryRun: true, ratePerMinute: 20 },
        });
    }
}
