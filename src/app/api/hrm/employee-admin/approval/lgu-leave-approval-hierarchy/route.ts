import { NextRequest, NextResponse } from "next/server";
import { LguLeaveHierarchyService } from "@/modules/human-resource-management/employee-admin/approval/lgu-leave-approval-hierarchy/services/lguLeaveHierarchyService";
import {
  createApproverSchema,
  updateApproverSchema,
} from "@/modules/human-resource-management/employee-admin/approval/lgu-leave-approval-hierarchy/types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const departmentId = searchParams.get("departmentId") || undefined;
    const level = searchParams.get("level") || undefined;
    const search = searchParams.get("search") || undefined;

    const result = await LguLeaveHierarchyService.fetchApprovers({
      departmentId,
      level,
      search,
    });

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("GET /api/hrm/employee-admin/approval/lgu-leave-approval-hierarchy error:", error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Failed to load approval hierarchy",
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validation = createApproverSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          message: "Validation failed",
          errors: validation.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const created = await LguLeaveHierarchyService.createApprover(validation.data);

    return NextResponse.json({
      success: true,
      message: "Approver successfully assigned to hierarchy level",
      data: created,
    });
  } catch (error) {
    console.error("POST /api/hrm/employee-admin/approval/lgu-leave-approval-hierarchy error:", error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Failed to create approver assignment",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const validation = updateApproverSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          message: "Validation failed",
          errors: validation.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { id, ...data } = validation.data;
    await LguLeaveHierarchyService.updateApprover(id, data);

    return NextResponse.json({
      success: true,
      message: "Approver assignment successfully updated",
    });
  } catch (error) {
    console.error("PATCH /api/hrm/employee-admin/approval/lgu-leave-approval-hierarchy error:", error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Failed to update approver assignment",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = Number(searchParams.get("id"));

    if (!id || isNaN(id)) {
      return NextResponse.json(
        { success: false, message: "Valid approver ID is required" },
        { status: 400 }
      );
    }

    await LguLeaveHierarchyService.deleteApprover(id);

    return NextResponse.json({
      success: true,
      message: "Approver assignment removed from hierarchy",
    });
  } catch (error) {
    console.error("DELETE /api/hrm/employee-admin/approval/lgu-leave-approval-hierarchy error:", error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Failed to delete approver assignment",
      },
      { status: 500 }
    );
  }
}
