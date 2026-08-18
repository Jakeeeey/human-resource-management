import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const DIRECTUS_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
    const TOKEN = process.env.DIRECTUS_STATIC_TOKEN;

    if (!DIRECTUS_URL) {
      return NextResponse.json(
        { error: "Upstream API base not configured" },
        { status: 500 }
      );
    }

    // Default folder UUID provided by the user for handbook attachments
    const folderId = "a858de20-254c-4b9b-a823-0b71a3eea0b9";

    const incomingForm = await req.formData();
    const outgoingForm = new FormData();

    if (folderId) {
      outgoingForm.append("folder", folderId);
    }

    const file = incomingForm.get("file");
    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB limit
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "File too large (Max 10MB)" }, { status: 413 });
    }

    outgoingForm.append("file", file);

    const response = await fetch(`${DIRECTUS_URL}/files`, {
      method: "POST",
      headers: {
        ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
      },
      body: outgoingForm,
    });

    const result = await response.json();

    if (!response.ok) {
      return NextResponse.json(result, { status: response.status });
    }

    return NextResponse.json(result);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
