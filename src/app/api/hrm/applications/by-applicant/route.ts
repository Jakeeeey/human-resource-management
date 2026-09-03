import { NextRequest, NextResponse } from "next/server";
import { decodeJwtPayload, COOKIE_NAME } from "@/lib/auth-utils";
import { dFetch, DIRECTUS_URL } from "@/lib/quiz-file-management/directus";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/hrm/applications/by-applicant?applicant_id=<id>
//
// Read-only bundle for the HR resume viewer: latest application row for the
// applicant plus every child-table section (family, relatives, education,
// licensure, work experience, references, trainings, attachments).
// Server-side only — dFetch carries DIRECTUS_STATIC_TOKEN, never the browser.

const CHILD_TABLES = [
    "application_family_member",
    "application_company_relative",
    "application_education",
    "application_licensure_exam",
    "application_work_experience",
    "application_reference",
    "application_training",
    "application_attachment",
] as const;

async function fetchAssetDataUrl(fileId: unknown): Promise<string | null> {
    if (typeof fileId !== "string" || !fileId) return null;
    const res = await fetch(`${DIRECTUS_URL}/assets/${fileId}`, {
        headers: { Authorization: `Bearer ${process.env.DIRECTUS_STATIC_TOKEN}` },
    });
    if (!res.ok) return null;
    const mime = res.headers.get("content-type") ?? "image/jpeg";
    const bytes = Buffer.from(await res.arrayBuffer()).toString("base64");
    return `data:${mime};base64,${bytes}`;
}

export async function GET(req: NextRequest) {
    try {
        const token = req.cookies.get(COOKIE_NAME)?.value;
        const payload = token ? decodeJwtPayload(token) : null;
        if (!payload) {
            return NextResponse.json({ error: "AUTH_DENIED" }, { status: 401 });
        }

        const applicantId = Number(req.nextUrl.searchParams.get("applicant_id"));
        if (!Number.isFinite(applicantId)) {
            return NextResponse.json({ error: "VALIDATION_FAILED: applicant_id must be a number." }, { status: 400 });
        }

        const appRes = (await dFetch(
            `/items/application?filter[applicant_id][_eq]=${applicantId}&sort=-submitted_at&limit=1`
        )) as { data?: Record<string, unknown>[] };
        const application = appRes?.data?.[0] ?? null;
        if (!application) {
            return NextResponse.json({ error: "DB_NOT_FOUND: no application for this applicant." }, { status: 404 });
        }

        const applicationId = application["id"];
        const children = await Promise.all(
            CHILD_TABLES.map(async (table) => {
                const res = (await dFetch(
                    `/items/${table}?filter[application_id][_eq]=${applicationId}&sort=sort&limit=-1`
                )) as { data?: Record<string, unknown>[] };
                return [table, res?.data ?? []] as const;
            })
        );

        // Stored photo/signature are Directus file UUIDs. The browser can't
        // call /assets with the server static token, so fetch the bytes here
        // and inline them as data URLs HR can view (read-only — nothing to edit).
        const [photo_image, signature_image] = await Promise.all([
            fetchAssetDataUrl(application["photo_file"]),
            fetchAssetDataUrl(application["signature_file"]),
        ]);

        return NextResponse.json({
            data: { application, ...Object.fromEntries(children), photo_image, signature_image },
        });
    } catch (err) {
        console.error("[applications/by-applicant]", err);
        return NextResponse.json({ error: "INTERNAL_FAIL" }, { status: 500 });
    }
}
