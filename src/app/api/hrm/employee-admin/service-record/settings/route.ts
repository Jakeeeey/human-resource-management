import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

const DIRECTUS_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
const COOKIE_NAME = "vos_access_token";

export const dynamic = "force-dynamic";

async function getAuthToken(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(COOKIE_NAME)?.value || null;
}

async function directusFetch(path: string, options: RequestInit = {}) {
  const token = process.env.DIRECTUS_STATIC_TOKEN || "";

  const response = await fetch(`${DIRECTUS_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Directus API error (${response.status}): ${error}`);
  }

  return response.json();
}

// ============================================================================
// GET: Fetch Service Record Default Settings
// ============================================================================
export async function GET() {
  try {
    const token = await getAuthToken();
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const res = await directusFetch(`/items/service_record_setting?limit=1`).catch(() => ({ data: [] }));
    const setting = res.data?.[0] || {
      id: 1,
      agency_name: "Republic of the Philippines",
      sub_header: "Department of Education",
      office_address: "",
      certification_text:
        "This is to certify that the employee named herein above actually rendered service in this Office as shown by the service record below. Each line of which is supported by appointment and other papers actually issued by this office and approved by the authorities concerned.",
      legal_basis_text:
        "Issued in compliance with Executive Order No. 54, dated August 10, 1954 in accordance with Circular No. 54, dated August 10, 1954 of the System.",
      default_prepared_by_name: "MELISSA O. SESIO",
      default_prepared_by_title: "Admin. Officer II",
      default_certified_by_name: "JOHN D. ALIDON",
      default_certified_by_title: "Admin. Officer IV/HRMO II",
    };

    return NextResponse.json({ data: setting });
  } catch (error) {
    console.error("GET /api/hrm/employee-admin/service-record/settings error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal Server Error" },
      { status: 500 }
    );
  }
}

// ============================================================================
// PUT / POST: Update Service Record Default Settings
// ============================================================================
export async function POST(req: NextRequest) {
  try {
    const token = await getAuthToken();
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();

    const existingRes = await directusFetch(`/items/service_record_setting?limit=1`).catch(() => ({ data: [] }));
    const existing = existingRes.data?.[0];

    const payload = {
      agency_name: body.agency_name || "Republic of the Philippines",
      sub_header: body.sub_header ?? "",
      office_address: body.office_address ?? "",
      certification_text: body.certification_text,
      legal_basis_text: body.legal_basis_text,
      default_prepared_by_name: body.default_prepared_by_name ?? "",
      default_prepared_by_title: body.default_prepared_by_title ?? "",
      default_certified_by_name: body.default_certified_by_name ?? "",
      default_certified_by_title: body.default_certified_by_title ?? "",
    };

    let result;
    if (existing && existing.id) {
      result = await directusFetch(`/items/service_record_setting/${existing.id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
    } else {
      result = await directusFetch(`/items/service_record_setting`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
    }

    return NextResponse.json({
      success: true,
      data: result.data,
      message: "Settings updated successfully",
    });
  } catch (error) {
    console.error("POST /api/hrm/employee-admin/service-record/settings error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal Server Error" },
      { status: 500 }
    );
  }
}
