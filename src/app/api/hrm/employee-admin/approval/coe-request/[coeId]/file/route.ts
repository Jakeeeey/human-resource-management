import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DIRECTUS_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ coeId: string }> },
) {
  try {
    const { coeId } = await params;
    const id = parseInt(coeId);
    if (Number.isNaN(id)) {
      return NextResponse.json({ error: "Invalid COE id" }, { status: 400 });
    }

    const token = process.env.DIRECTUS_STATIC_TOKEN || "";
    const coeRes = await fetch(
      `${DIRECTUS_URL}/items/coe_requests/${id}?fields=ecopy_file_url`,
      {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      },
    );

    if (!coeRes.ok) {
      return NextResponse.json({ error: "COE request not found" }, { status: 404 });
    }

    const coeData = await coeRes.json();
    const filePath: string | null = coeData.data?.ecopy_file_url;

    if (!filePath) {
      return NextResponse.json({ error: "No file attached" }, { status: 404 });
    }

    const fileUrl = filePath.startsWith("http")
      ? filePath
      : `${DIRECTUS_URL}${filePath.startsWith("/") ? "" : "/"}${filePath}`;

    let filename = `COE-${coeId}.pdf`;
    let contentType = "application/pdf";

    const uuidMatch = filePath.match(/\/assets\/([^/]+)/);
    if (uuidMatch) {
      const fileUuid = uuidMatch[1];
      const fileMetaRes = await fetch(`${DIRECTUS_URL}/files/${fileUuid}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      if (fileMetaRes.ok) {
        const fileMeta = await fileMetaRes.json();
        filename = fileMeta.data?.filename_download || filename;
        contentType = fileMeta.data?.type || contentType;
      }
    }

    const upstream = await fetch(fileUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!upstream.ok || !upstream.body) {
      return NextResponse.json(
        { error: "Failed to retrieve file from storage" },
        { status: 502 },
      );
    }

    const dispositionParam = req.nextUrl.searchParams.get("download");
    const disposition = dispositionParam === "1" ? "attachment" : "inline";

    return new Response(upstream.body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `${disposition}; filename*=UTF-8''${encodeURIComponent(filename)}`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("[COE file stream] error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
