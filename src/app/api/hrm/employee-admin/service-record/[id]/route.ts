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
// PUT: Update an existing service record entry
// ============================================================================
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = await getAuthToken();
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();

    const updatePayload: Record<string, unknown> = {};
    if (body.service_from !== undefined) updatePayload.service_from = body.service_from;
    if (body.service_to !== undefined) updatePayload.service_to = body.service_to || null;
    if (body.designation !== undefined) updatePayload.designation = body.designation;
    if (body.appointment_status !== undefined) updatePayload.appointment_status = body.appointment_status;
    if (body.salary !== undefined) updatePayload.salary = Number(body.salary || 0);
    if (body.salary_basis !== undefined) updatePayload.salary_basis = body.salary_basis;
    if (body.station_assignment !== undefined) updatePayload.station_assignment = body.station_assignment;
    if (body.branch !== undefined) updatePayload.branch = body.branch;
    if (body.leave_wo_pay !== undefined) updatePayload.leave_wo_pay = body.leave_wo_pay || "None";
    if (body.cause !== undefined) updatePayload.cause = body.cause;
    if (body.remarks !== undefined) updatePayload.remarks = body.remarks ?? null;
    if (body.sequence_order !== undefined) updatePayload.sequence_order = Number(body.sequence_order || 1);

    const updated = await directusFetch(`/items/employee_service_record/${id}`, {
      method: "PATCH",
      body: JSON.stringify(updatePayload),
    });

    return NextResponse.json({
      success: true,
      data: updated.data,
      message: "Service record entry updated successfully",
    });
  } catch (error) {
    console.error("PUT /api/hrm/employee-admin/service-record/[id] error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal Server Error" },
      { status: 500 }
    );
  }
}

// ============================================================================
// DELETE: Delete a service record entry
// ============================================================================
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = await getAuthToken();
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    await directusFetch(`/items/employee_service_record/${id}`, {
      method: "DELETE",
    });

    return NextResponse.json({
      success: true,
      message: "Service record entry deleted successfully",
    });
  } catch (error) {
    console.error("DELETE /api/hrm/employee-admin/service-record/[id] error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal Server Error" },
      { status: 500 }
    );
  }
}
