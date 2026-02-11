import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { promises as fs } from "fs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function contentTypeFromExt(ext: string) {
  switch (ext.toLowerCase()) {
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".webp":
      return "image/webp";
    case ".gif":
      return "image/gif";
    case ".svg":
      return "image/svg+xml";
    case ".pdf":
      return "application/pdf";
    default:
      return "application/octet-stream";
  }
}

async function statSafe(p: string) {
  try {
    return await fs.stat(p);
  } catch {
    return null;
  }
}

async function listDirSafe(dir: string) {
  try {
    const items = await fs.readdir(dir);
    return items.slice(0, 50); // limit
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest, ctx: any) {
  try {
    const params = await ctx?.params;
    const parts: string[] = (params?.path ?? []) as string[];

    if (!Array.isArray(parts) || parts.length === 0) {
      return NextResponse.json({ message: "Missing file path." }, { status: 400 });
    }

    const safeParts = parts.filter((p) => p && p !== "." && p !== "..");
    const filename = safeParts[safeParts.length - 1] || "file";
    const relDirParts = safeParts.slice(0, -1); // folder inside uploads

    const cwd = process.cwd();

    // Candidate roots for /public/uploads
    const roots = [
      path.join(cwd, "public", "uploads"),
      path.join(cwd, "..", "public", "uploads"),
      path.join(cwd, "..", "..", "public", "uploads"),
    ];

    // Build candidate file paths
    const candidates = roots.map((root) => path.join(root, ...relDirParts, filename));

    let filePath: string | null = null;

    for (const c of candidates) {
      const st = await statSafe(c);
      if (st?.isFile()) {
        filePath = c;
        break;
      }
    }

    if (!filePath) {
      // also try listing the directory to show what's actually there
      const dirsToInspect = roots.map((root) => path.join(root, ...relDirParts));
      const listings = await Promise.all(dirsToInspect.map((d) => listDirSafe(d)));

      return NextResponse.json(
        {
          message: "File not found.",
          looked_in: candidates,
          inspected_dirs: dirsToInspect,
          available_files: listings,
          hint:
            "Pick the exact filename from available_files and use it in the URL. Then add ?download=1 to download.",
        },
        { status: 404 },
      );
    }

    const buf = await fs.readFile(filePath);
    const ext = path.extname(filePath);
    const ct = contentTypeFromExt(ext);

    const url = new URL(req.url);
    const forceDownload =
      url.searchParams.get("download") === "1" || url.searchParams.get("download") === "true";

    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": ct,
        "Cache-Control": "no-store",
        ...(forceDownload ? { "Content-Disposition": `attachment; filename="${filename}"` } : {}),
      },
    });
  } catch (e: any) {
    return NextResponse.json({ message: e?.message ?? "Failed to serve file." }, { status: 500 });
  }
}
