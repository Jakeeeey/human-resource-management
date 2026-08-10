import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

const DIRECTUS_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
const COOKIE_NAME = "vos_access_token";

export const dynamic = "force-dynamic";

function decodeJwtPayload(token: string) {
  try {
    if (!token) return null;
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const p = parts[1];
    const b64 = p.replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
    const json = Buffer.from(padded, "base64").toString("utf8");
    return JSON.parse(json);
  } catch {
    return null;
  }
}

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
    throw new Error(`Directus API error: ${response.status} - ${error}`);
  }

  return response.json();
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const token = await getAuthToken();
    const payload = token ? decodeJwtPayload(token) : null;

    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { status, remarks } = body;

    if (!status || !["approved", "rejected"].includes(status)) {
      return NextResponse.json(
        { error: "Invalid status provided" },
        { status: 400 }
      );
    }

    // 1. Fetch the change request to get its details
    const requestRes = await directusFetch(`/items/attendance_change_request/${id}`);
    const changeRequest = requestRes.data;

    if (!changeRequest) {
      return NextResponse.json(
        { error: "Change request not found" },
        { status: 404 }
      );
    }

    // 2. Update the change request status
    await directusFetch(`/items/attendance_change_request/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status, remarks }),
    });

    // 3. If approved, apply the changes to the attendance_log table
    if (status === "approved") {
      const { user_id, log_date, time_in, lunch_start, lunch_end, break_start, break_end, time_out } = changeRequest;

      // Find the corresponding attendance_log
      const logsRes = await directusFetch(
        `/items/attendance_log?filter[user_id][_eq]=${user_id}&filter[log_date][_eq]=${log_date.split('T')[0]}&limit=1`
      );
      const originalLog = logsRes.data?.[0];

      const formatDateTime = (timeString: string | null | undefined, dateStr: string) => {
        if (!timeString) return null;
        if (timeString.includes('T')) return timeString; // Already ISO datetime
        const cleanDate = dateStr.split('T')[0];
        return `${cleanDate}T${timeString}`;
      };

      if (originalLog) {

        const updatePayload: Record<string, string | null> = {};
        if (time_in !== undefined) updatePayload.time_in = formatDateTime(time_in, log_date);
        if (lunch_start !== undefined) updatePayload.lunch_start = formatDateTime(lunch_start, log_date);
        if (lunch_end !== undefined) updatePayload.lunch_end = formatDateTime(lunch_end, log_date);
        if (break_start !== undefined) updatePayload.break_start = formatDateTime(break_start, log_date);
        if (break_end !== undefined) updatePayload.break_end = formatDateTime(break_end, log_date);
        if (time_out !== undefined) updatePayload.time_out = formatDateTime(time_out, log_date);

        // Also reset the approval status to 'pending' to trigger recalculations
        updatePayload.approve_status = 'pending';

        await directusFetch(`/items/attendance_log/${originalLog.log_id}`, {
          method: "PATCH",
          body: JSON.stringify(updatePayload),
        });
      } else {
        // Fetch user department since it's required
        const userRes = await directusFetch(`/items/user/${user_id}?fields=user_department`);
        const user_department = userRes.data?.user_department;

        if (!user_department) {
          throw new Error("Cannot create attendance log: User department not found.");
        }

        const createPayload: Record<string, string | number | null> = {
          user_id,
          department_id: user_department,
          log_date: log_date.split('T')[0],
          approve_status: 'pending',
          status: 'On Time'
        };

        if (time_in !== undefined) createPayload.time_in = formatDateTime(time_in, log_date);
        if (lunch_start !== undefined) createPayload.lunch_start = formatDateTime(lunch_start, log_date);
        if (lunch_end !== undefined) createPayload.lunch_end = formatDateTime(lunch_end, log_date);
        if (break_start !== undefined) createPayload.break_start = formatDateTime(break_start, log_date);
        if (break_end !== undefined) createPayload.break_end = formatDateTime(break_end, log_date);
        if (time_out !== undefined) createPayload.time_out = formatDateTime(time_out, log_date);

        await directusFetch(`/items/attendance_log`, {
          method: "POST",
          body: JSON.stringify(createPayload),
        });
      }
    }

    return NextResponse.json({ success: true, message: `Request ${status} successfully` });
  } catch (error: unknown) {
    console.error("PATCH attendance_change_request error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to update modification request", details: errorMessage },
      { status: 500 }
    );
  }
}
