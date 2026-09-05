import { NextRequest, NextResponse } from "next/server";
import { decodeJwtPayload, COOKIE_NAME } from "@/lib/auth-utils";
import { dFetch, DIRECTUS_URL } from "@/modules/human-resource-management/shared/utils/directus";

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

        // Attachments are Directus file UUIDs too. Inline each as a data URL
        // with its stored filename so HR can view/download read-only files
        // (same token reasoning as photo/signature above).
        const attachmentRows = (children.find(([t]) => t === "application_attachment")?.[1] ?? []) as Record<string, unknown>[];
        const attachment_files = await Promise.all(
            attachmentRows.map(async (row) => {
                const fileId = row["file"];
                const meta =
                    typeof fileId === "string" && fileId
                        ? ((await dFetch(`/files/${fileId}?fields=filename_download`)) as {
                              data?: { filename_download?: string };
                          })
                        : null;
                return {
                    type: typeof row["type"] === "string" ? row["type"] : "Other",
                    label: typeof row["label"] === "string" ? row["label"] : "",
                    filename: meta?.data?.filename_download ?? "attachment",
                    file_url: await fetchAssetDataUrl(fileId),
                };
            })
        );

        return NextResponse.json({
            data: { application, ...Object.fromEntries(children), photo_image, signature_image, attachment_files },
        });
    } catch (err) {
        console.error("[applications/by-applicant]", err);
        return NextResponse.json({ error: "INTERNAL_FAIL" }, { status: 500 });
    }
}
