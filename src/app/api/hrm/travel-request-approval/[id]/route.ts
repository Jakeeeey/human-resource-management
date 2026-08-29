import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { decodeJwtPayload } from "@/lib/auth-utils";
import { updateTravelRequestStatus } from "@/modules/human-resource-management/travel-request-approval/services/travel-request-approval.service";
import { TravelRequestApprovalPayloadSchema } from "@/modules/human-resource-management/travel-request-approval/types/schema";

const COOKIE_NAME = "vos_access_token";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;
    if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const payload = decodeJwtPayload(token);
    const userId = payload?.sub ? Number(payload.sub) : null;
    if (!userId) return NextResponse.json({ message: "Invalid token" }, { status: 401 });

    const p = await params;
    const id = p.id;
    console.log("PATCH travel-request-approval ID:", id);
    if (!id || id === "undefined" || id === "NaN") return NextResponse.json({ message: "Invalid ID" }, { status: 400 });

    const body = await request.json();
    
    // Validate request body
    const validatedData = TravelRequestApprovalPayloadSchema.safeParse(body);
    if (!validatedData.success) {
      return NextResponse.json({ 
        message: "Validation failed", 
        errors: validatedData.error.flatten() 
      }, { status: 400 });
    }

    const travelRequest = await updateTravelRequestStatus(id, validatedData.data);
    
    return NextResponse.json({ data: travelRequest, message: "Request updated successfully" }, { status: 200 });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ message: errorMsg }, { status: 500 });
  }
}
