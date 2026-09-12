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

        // Committed manpower request: the applicant's resolved request carries
        // the department/division the job-offer envelope prefills. Every hop is
        // optional — a missing row just yields null names. Any failure here
        // must never break the resume bundle, so it has its own try/catch.
        let committed_request: {
            manpower_request_id: number;
            department_name: string | null;
            division_name: string | null;
            position: string | null;
        } | null = null;
        try {
            const applicantRes = (await dFetch(
                `/items/applicant/${applicantId}?fields=manpower_request_id`
            )) as { data?: { manpower_request_id?: unknown } };
            const manpowerRequestId = applicantRes?.data?.manpower_request_id;
            if (typeof manpowerRequestId === "number") {
                const requestRes = (await dFetch(
                    `/items/manpower_request/${manpowerRequestId}?fields=requesting_department_id,division_id,position`
                )) as {
                    data?: {
                        requesting_department_id?: unknown;
                        division_id?: unknown;
                        position?: unknown;
                    };
                };
                const request = requestRes?.data ?? null;

                let department_name: string | null = null;
                if (typeof request?.requesting_department_id === "number") {
                    const deptRes = (await dFetch(
                        `/items/department/${request.requesting_department_id}?fields=department_name`
                    )) as { data?: { department_name?: unknown } };
                    department_name =
                        typeof deptRes?.data?.department_name === "string" ? deptRes.data.department_name : null;
                }

                let division_name: string | null = null;
                if (typeof request?.division_id === "number") {
                    const divRes = (await dFetch(
                        `/items/division/${request.division_id}?fields=division_name`
                    )) as { data?: { division_name?: unknown } };
                    division_name =
                        typeof divRes?.data?.division_name === "string" ? divRes.data.division_name : null;
                }

                committed_request = {
                    manpower_request_id: manpowerRequestId,
                    department_name,
                    division_name,
                    position: typeof request?.position === "string" ? request.position : null,
                };
            }
        } catch {
            committed_request = null;
        }

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
            data: {
                application,
                ...Object.fromEntries(children),
                photo_image,
                signature_image,
                attachment_files,
                committed_request,
            },
        });
    } catch (err) {
        console.error("[applications/by-applicant]", err);
        return NextResponse.json({ error: "INTERNAL_FAIL" }, { status: 500 });
    }
}
