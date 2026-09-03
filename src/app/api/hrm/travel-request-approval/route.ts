import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { decodeJwtPayload } from "@/lib/auth-utils";
import { fetchPendingTravelRequests } from "@/modules/human-resource-management/travel-request-approval/services/travel-request-approval.service";

const COOKIE_NAME = "vos_access_token";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;
    if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const payload = decodeJwtPayload(token);
    const userId = payload?.sub ? Number(payload.sub) : null;
    if (!userId) return NextResponse.json({ message: "Invalid token" }, { status: 401 });

    const usersMap = new Map();
    const SPRING_URL = process.env.SPRING_API_BASE_URL;
    if (SPRING_URL) {
      try {
        const usersRes = await fetch(`${SPRING_URL.replace(/\/+$/, "")}/users`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (usersRes.ok) {
          const users = await usersRes.json();
          users.forEach((u: { id: number; firstName: string; lastName: string }) => {
            usersMap.set(u.id, `${u.firstName || ""} ${u.lastName || ""}`.trim());
          });
        }
      } catch (err) {
        console.error("Failed to fetch users for travel request mapping", err);
      }
    }

    const travelRequests = await fetchPendingTravelRequests();
    const mappedRequests = travelRequests.map((req: Record<string, unknown>) => ({
      ...req,
      id: req.travel_id || req.id,
      requester_name: req.user_id ? usersMap.get(req.user_id) || `User ${req.user_id}` : "Unknown"
    }));
    
    return NextResponse.json({ data: mappedRequests }, { status: 200 });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ message: errorMsg }, { status: 500 });
  }
}
