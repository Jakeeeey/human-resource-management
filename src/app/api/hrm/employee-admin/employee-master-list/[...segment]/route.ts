import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const UPSTREAM_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;  // Directus
const DIRECTUS_TOKEN = process.env.DIRECTUS_STATIC_TOKEN;
const SPRING_BASE = process.env.SPRING_API_BASE_URL;        // Spring Boot

function decodeJwt(token: string): Record<string, unknown> | null {
  try {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      Buffer.from(base64, "base64")
        .toString()
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

async function proxy(req: NextRequest) {
  const url = new URL(req.url);
  const { pathname, search } = url;

  // Extract the segment after /employee-master-list/
  const segment = pathname.split("/employee-master-list/")[1];

  const method = req.method;
  const isReadOp = ["GET", "HEAD"].includes(method);

  // ── Route to the correct upstream ──────────────────────────────────────────

  // GET /employees  →  Spring Boot /users
  // GET /file-records → Spring Boot /users/file-records
  // GET /record-categories → Spring Boot /users/record-categories
  // GET /record-types → Spring Boot /users/record-types
  if (
    (segment === "employees") &&
    isReadOp
  ) {
    if (!SPRING_BASE) {
      return NextResponse.json({ error: "Spring Boot API base not configured" }, { status: 500 });
    }

    // Forward the VOS access token as Bearer so Spring Boot accepts the request
    const vosToken = req.cookies.get("vos_access_token")?.value;

    let springSegment = "";
    switch (segment) {
      case "employees":
        springSegment = "users";
        break;
    }

    const upstreamUrl = `${SPRING_BASE.replace(/\/+$/, "")}/${springSegment}${search ? search : ""}`;

    try {
      const res = await fetch(upstreamUrl, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          ...(vosToken ? { Authorization: `Bearer ${vosToken}` } : {}),
        },
        cache: "no-store",
      });

      const data = await res.arrayBuffer();
      const contentType = res.headers.get("content-type") || "application/json";
      return new NextResponse(data, {
        status: res.status,
        headers: { "content-type": contentType },
      });
    } catch (err) {
      console.error("[Proxy Error] GET /users (Spring):", err);
      return NextResponse.json({ error: "Proxy request failed" }, { status: 502 });
    }
  }


  // All other segments → Directus
  if (!UPSTREAM_BASE) {
    return NextResponse.json({ error: "Upstream API base not configured" }, { status: 500 });
  }

  // Mapping local segments to Directus items
  let upstreamGETPath = "";   // only used for GET/HEAD — includes field expansion + limit
  let upstreamMutatePath = ""; // used for POST/PATCH/DELETE — clean resource path

  switch (segment) {
    case "employees":
      upstreamGETPath = "/items/user?fields=*.*,user_department.*&limit=-1";
      upstreamMutatePath = "/items/user";
      break;
    case "departments":
      upstreamGETPath = "/items/department?fields=*&limit=-1";
      upstreamMutatePath = "/items/department";
      break;
    case "company":
      upstreamGETPath = "/items/company?fields=*&limit=-1";
      upstreamMutatePath = "/items/company";
      break;
    case "file-records":
      upstreamGETPath = "/items/employee_file_records?fields=*.*,list_id.*,list_id.record_type_id.*&limit=-1";
      upstreamMutatePath = "/items/employee_file_records";
      break;
    case "record-types":
      upstreamGETPath = "/items/employee_file_record_type?fields=*&limit=-1";
      upstreamMutatePath = "/items/employee_file_record_type";
      break;
    case "record-lists":
      upstreamGETPath = "/items/employee_file_record_list?fields=*&limit=-1";
      upstreamMutatePath = "/items/employee_file_record_list";
      break;
    case "items":
      upstreamGETPath = "/items/items?fields=*&limit=-1";
      upstreamMutatePath = "/items/items";
      break;
    case "assets-and-equipments":
      upstreamGETPath = "/items/assets_and_equipment?fields=*.*&limit=-1";
      upstreamMutatePath = "/items/assets_and_equipment";
      break;
    case "asset-assignments":
      upstreamGETPath = "/items/asset_assignments?fields=*&limit=-1";
      upstreamMutatePath = "/items/asset_assignments";
      break;
    default:
      if (segment.startsWith("employees/")) {
        const id = segment.split("/")[1];
        upstreamGETPath = `/items/user/${id}?fields=*.*,user_department.*`;
        upstreamMutatePath = `/items/user/${id}`;
      } else if (segment.startsWith("departments/")) {
        const id = segment.split("/")[1];
        upstreamGETPath = `/items/department/${id}`;
        upstreamMutatePath = `/items/department/${id}`;
      } else if (segment.startsWith("file-records/")) {
        const id = segment.split("/")[1];
        upstreamGETPath = `/items/employee_file_records/${id}`;
        upstreamMutatePath = `/items/employee_file_records/${id}`;
      } else if (segment.startsWith("assets-and-equipments/")) {
        const id = segment.split("/")[1];
        upstreamGETPath = `/items/assets_and_equipment/${id}`;
        upstreamMutatePath = `/items/assets_and_equipment/${id}`;
      } else if (segment.startsWith("asset-assignments/")) {
        const id = segment.split("/")[1];
        upstreamGETPath = `/items/asset_assignments/${id}`;
        upstreamMutatePath = `/items/asset_assignments/${id}`;
      } else if (segment.startsWith("company/")) {
        const id = segment.split("/")[1];
        upstreamGETPath = `/items/company/${id}`;
        upstreamMutatePath = `/items/company/${id}`;
      } else if (segment.startsWith("assets/")) {
        upstreamGETPath = `/${segment}`;
        upstreamMutatePath = `/${segment}`;
      }
  }

  const rawPath = isReadOp ? upstreamGETPath : upstreamMutatePath;

  if (!rawPath) {
    return NextResponse.json({ error: `Invalid proxy segment: ${segment}` }, { status: 400 });
  }

  // Append extra search params only for reads (avoid polluting mutations)
  const upstreamUrl = `${UPSTREAM_BASE.replace(/\/+$/, "")}${rawPath}${isReadOp && search ? (rawPath.includes("?") ? `&${search.slice(1)}` : search) : ""
    }`;

  const headers = new Headers();
  if (DIRECTUS_TOKEN) {
    headers.set("Authorization", `Bearer ${DIRECTUS_TOKEN}`);
  }

  let body: BodyInit | undefined;
  if (!isReadOp) {
    const contentType = req.headers.get("content-type") || "";
    if (contentType.includes("multipart/form-data")) {
      // Forward raw multipart body — do NOT set Content-Type, browser sets boundary
      body = await req.arrayBuffer();
    } else {
      headers.set("Content-Type", "application/json");
      const rawBody = await req.text();
      let parsedBody: Record<string, unknown> | null = null;
      try {
        parsedBody = JSON.parse(rawBody);
      } catch { }

      if (parsedBody && segment.startsWith("file-records")) {
        const vosToken = req.cookies.get("vos_access_token")?.value;
        if (vosToken) {
          const payload = decodeJwt(vosToken);
          const userId = payload?.sub ? parseInt(payload.sub as string, 10) : null;
          if (userId) {
            if (method === "POST") {
              parsedBody.created_by = userId;
              parsedBody.updated_by = userId;
            } else if (method === "PATCH" || method === "PUT") {
              parsedBody.updated_by = userId;
            }
          }
        }
        body = JSON.stringify(parsedBody);
      } else if (parsedBody && (segment === "asset-assignments" || segment.startsWith("assets-and-equipments"))) {
        const vosToken = req.cookies.get("vos_access_token")?.value;
        if (vosToken) {
          const payload = decodeJwt(vosToken);
          const userId = payload?.sub ? parseInt(payload.sub as string, 10) : null;
          if (userId) {
            if (segment === "asset-assignments" && method === "POST") {
              parsedBody.assigned_by = userId;
            } else if (segment.startsWith("assets-and-equipments") && (method === "PATCH" || method === "PUT")) {
              parsedBody.encoder = userId;
            }
          }
        }
        body = JSON.stringify(parsedBody);
      } else {
        body = rawBody;
      }
    }
  }

  try {
    const res = await fetch(upstreamUrl, {
      method,
      headers,
      body,
      cache: "no-store",
    });

    const data = await res.arrayBuffer();
    const contentType = res.headers.get("content-type") || "application/octet-stream";
    const responseHeaders: Record<string, string> = { "content-type": contentType };

    // Force download with proper filename for asset requests
    if (segment.startsWith("assets/")) {
      const downloadFilename = url.searchParams.get("filename");
      // Try to get extension from content-type
      const mimeType = contentType.split(";")[0].trim();
      const mimeMap: Record<string, string> = {
        "image/jpeg": "jpg",
        "image/png": "png",
        "image/gif": "gif",
        "application/pdf": "pdf",
        "application/msword": "doc",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
        "application/vnd.ms-excel": "xls",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx"
      };
      const ext = mimeMap[mimeType] || mimeType.split("/")[1] || "";
      
      let safeName = downloadFilename
        ? downloadFilename.replace(/[^\w\s.\-()]/gi, "_").trim()
        : "file";

      // Append extension if missing (case-insensitive check)
      if (ext && !safeName.toLowerCase().endsWith("." + ext.toLowerCase())) {
        safeName += "." + ext;
      }

      responseHeaders["Content-Disposition"] = `attachment; filename="${safeName}"`;
    }

    return new NextResponse(data, {
      status: res.status,
      headers: responseHeaders,
    });
  } catch (err) {
    console.error(`[Proxy Error] ${method} ${upstreamUrl}:`, err);
    return NextResponse.json({ error: "Proxy request failed" }, { status: 502 });
  }
}

export async function GET(req: NextRequest) { return proxy(req); }
export async function POST(req: NextRequest) { return proxy(req); }
export async function DELETE(req: NextRequest) { return proxy(req); }
export async function PATCH(req: NextRequest) { return proxy(req); }
