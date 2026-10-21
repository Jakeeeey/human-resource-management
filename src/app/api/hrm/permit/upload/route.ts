import { NextRequest, NextResponse } from "next/server";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "";
const DIRECTUS_TOKEN = process.env.DIRECTUS_STATIC_TOKEN || "";

const normalizeUrl = (url?: string | null): string => {
  if (!url) return "";
  const trimmed = url.trim();
  return trimmed.endsWith("/") ? trimmed.slice(0, -1) : trimmed;
};

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ success: false, message: "No file provided" }, { status: 400 });
    }

    const targetDirectusUrl = normalizeUrl(API_BASE_URL);

    // Prepare upload payload for Company Directus
    const backendFormData = new FormData();
    backendFormData.append("file", file);

    const uploadRes = await fetch(`${targetDirectusUrl}/files`, {
      method: "POST",
      headers: {
        ...(DIRECTUS_TOKEN ? { Authorization: `Bearer ${DIRECTUS_TOKEN}` } : {}),
      },
      body: backendFormData,
    });

    if (!uploadRes.ok) {
      const errorText = await uploadRes.text();
      return NextResponse.json(
        { success: false, message: `Upload failed: ${errorText.slice(0, 150)}` },
        { status: 500 }
      );
    }

    const data = await uploadRes.json();
    const fileId = data?.data?.id;

    // Return the clean directus file ID/UUID as file_url
    return NextResponse.json({
      success: true,
      data: data.data,
      file_id: fileId,
      file_url: fileId,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
