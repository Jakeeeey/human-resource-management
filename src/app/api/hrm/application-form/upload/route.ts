import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

// Proxies an application-form file (photo / signature / attachment) up to
// Directus `/files`, into a per-kind folder, and returns the created file
// record whose `data.id` is the CHAR(36) UUID stored on the application row
// (or an application_attachment row). Modeled on
// src/app/api/hrm/quiz-file-management/file-management/question-image-upload/route.ts.

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const KINDS = ["photo", "signature", "attachment"] as const;
type Kind = (typeof KINDS)[number];

// Attachments cover resume/transcript/ID/certificate uploads, so they also
// accept PDF; photo/signature stay image-only.
function allowedTypesFor(kind: Kind): string[] {
    return kind === "attachment" ? [...IMAGE_TYPES, "application/pdf"] : IMAGE_TYPES;
}

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const DIRECTUS_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
        const DIRECTUS_TOKEN = process.env.DIRECTUS_STATIC_TOKEN;

        const kindRaw = (formData.get("kind") as string | null)?.trim() || "";
        const kind = (KINDS as readonly string[]).includes(kindRaw)
            ? (kindRaw as Kind)
            : null;
        if (!kind) {
            return NextResponse.json(
                { error: `kind must be one of: ${KINDS.join(", ")}` },
                { status: 400 },
            );
        }

        const file = formData.get("file") as File | null;
        if (!file) {
            return NextResponse.json({ error: "No file provided" }, { status: 400 });
        }

        if (file.size > MAX_FILE_SIZE) {
            return NextResponse.json(
                {
                    error: `File too large. Maximum size is 5 MB (got ${(file.size / 1024 / 1024).toFixed(2)} MB)`,
                },
                { status: 413 },
            );
        }

        const allowed = allowedTypesFor(kind);
        if (!allowed.includes(file.type)) {
            return NextResponse.json(
                { error: `Invalid file type "${file.type}". Allowed: ${allowed.join(", ")}` },
                { status: 415 },
            );
        }

        const targetFolderName = `application_form_${kind}`;

        let folderId = "";
        const folderSearchRes = await fetch(
            `${DIRECTUS_URL}/folders?filter[name][_eq]=${targetFolderName}&fields=id`,
            { headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` } },
        );
        const folderSearch = await folderSearchRes.json();

        if (folderSearch.data && folderSearch.data.length > 0) {
            folderId = folderSearch.data[0].id;
        } else {
            const createFolderRes = await fetch(`${DIRECTUS_URL}/folders`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${DIRECTUS_TOKEN}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ name: targetFolderName }),
            });
            const createdFolder = await createFolderRes.json();
            folderId = createdFolder.data?.id;
        }

        const outgoingForm = new FormData();
        if (folderId) {
            outgoingForm.append("folder", folderId);
        }
        outgoingForm.append("file", file);

        const response = await fetch(`${DIRECTUS_URL}/files`, {
            method: "POST",
            headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` },
            body: outgoingForm,
        });

        const result = await response.json();

        if (!response.ok) {
            console.error("Directus Upload Error:", result);
            return NextResponse.json(
                { error: result.errors?.[0]?.message || "Upload failed" },
                { status: response.status },
            );
        }

        return NextResponse.json(result);
    } catch (error: unknown) {
        console.error("Application Form Upload Error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal Server Error" },
            { status: 500 },
        );
    }
}
