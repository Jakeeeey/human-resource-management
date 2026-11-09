import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const DIRECTUS_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
    const DIRECTUS_TOKEN = process.env.DIRECTUS_STATIC_TOKEN;

    const targetFolderName = "quiz_question_image";

    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File too large. Maximum size is 5 MB (got ${(file.size / 1024 / 1024).toFixed(2)} MB)` },
        { status: 413 },
      );
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: `Invalid file type "${file.type}". Allowed: JPEG, PNG, WebP, GIF` },
        { status: 415 },
      );
    }

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
    console.error("Question Image Upload Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal Server Error" },
      { status: 500 },
    );
  }
}
