import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const PDF_MIME = "application/pdf";
const FOLDER_NAME = "resignation_files";
const PDF_MAGIC = "%PDF-";
const ALLOWED_MIMES: readonly string[] = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    PDF_MIME,
];

function fail(message: string, status: number) {
    return NextResponse.json({ success: false, message }, { status });
}

async function hasPdfMagic(file: Blob): Promise<boolean> {
    const head = await file.slice(0, PDF_MAGIC.length).text();
    return head === PDF_MAGIC;
}

export async function POST(req: NextRequest) {
    try {
        const DIRECTUS_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
        const TOKEN = process.env.DIRECTUS_STATIC_TOKEN;

        if (!DIRECTUS_URL) {
            return fail("Upstream API base not configured", 500);
        }

        const incomingForm = await req.formData();
        const file = incomingForm.get("file");
        if (!file || !(file instanceof Blob)) {
            return fail("No file provided", 400);
        }

        if (file.size > MAX_FILE_SIZE) {
            return fail(
                `File too large. Maximum size is 10 MB (got ${(file.size / 1024 / 1024).toFixed(2)} MB)`,
                413
            );
        }

        const mime = file instanceof File ? file.type : "";
        if (!ALLOWED_MIMES.includes(mime)) {
            return fail(
                `Invalid file type "${mime || "unknown"}". Only ${ALLOWED_MIMES.join(", ")} are allowed`,
                415
            );
        }
        if (mime === PDF_MIME && !(await hasPdfMagic(file))) {
            return fail("File content is not a PDF document", 415);
        }

        let folderId: string | undefined;
        try {
            const folderRes = await fetch(
                `${DIRECTUS_URL}/folders?filter[name][_eq]=${FOLDER_NAME}&fields=id`,
                { headers: TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {} }
            );
            const folderData = folderRes.ok
                ? ((await folderRes.json()) as { data?: { id?: string }[] })
                : null;
            folderId = folderData?.data?.[0]?.id;

            if (!folderId) {
                const createRes = await fetch(`${DIRECTUS_URL}/folders`, {
                    method: "POST",
                    headers: {
                        ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ name: FOLDER_NAME }),
                });
                const created = (await createRes.json().catch(() => null)) as {
                    data?: { id?: string };
                } | null;
                folderId = created?.data?.id;
                if (!folderId) {
                    console.error(
                        `[resignation-upload] Could not create folder "${FOLDER_NAME}":`,
                        created
                    );
                }
            }
        } catch (err) {
            console.error(`[resignation-upload] Error resolving folder "${FOLDER_NAME}":`, err);
        }

        const outgoingForm = new FormData();
        if (folderId) {
            outgoingForm.append("folder", folderId);
        } else {
            console.warn("[resignation-upload] No valid folder ID resolved; uploading without folder");
        }
        outgoingForm.append("file", file);

        const response = await fetch(`${DIRECTUS_URL}/files`, {
            method: "POST",
            headers: {
                ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
            },
            body: outgoingForm,
        });

        const result = (await response.json().catch(() => null)) as {
            data?: { id?: string };
            errors?: { message?: string }[];
        } | null;

        if (!response.ok) {
            console.error("[resignation-upload] Directus upload error:", result);
            return fail(
                result?.errors?.[0]?.message || "Upload failed",
                response.status
            );
        }

        const id = result?.data?.id;
        if (!id) {
            return fail("Upload succeeded but no file id was returned", 502);
        }

        return NextResponse.json({ success: true, data: { id } });
    } catch (error: unknown) {
        console.error("[resignation-upload] upload error:", error);
        return fail(
            error instanceof Error ? error.message : "An unexpected error occurred. Please try again later.",
            500
        );
    }
}
