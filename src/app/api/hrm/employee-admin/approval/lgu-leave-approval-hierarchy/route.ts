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

    // Check if department-level setup action
    if (body.action === "setup-department") {
      await LguLeaveHierarchyService.setupDepartmentHierarchy({
        department_id: Number(body.department_id),
        level1_approver_id: body.level1_approver_id !== undefined ? (body.level1_approver_id ? Number(body.level1_approver_id) : null) : undefined,
        level2_approver_id: body.level2_approver_id !== undefined ? (body.level2_approver_id ? Number(body.level2_approver_id) : null) : undefined,
        level3_approver_id: body.level3_approver_id !== undefined ? (body.level3_approver_id ? Number(body.level3_approver_id) : null) : undefined,
      });

      return NextResponse.json({
        success: true,
        message: "Department hierarchy successfully configured",
      });
    }

    // Check if batch-standard action
    if (body.action === "batch-standard") {
      await LguLeaveHierarchyService.batchApplyStandardApprovers({
        target_department_ids: Array.isArray(body.target_department_ids) ? body.target_department_ids.map(Number) : [],
        level2_approver_id: body.level2_approver_id ? Number(body.level2_approver_id) : null,
        level3_approver_id: body.level3_approver_id ? Number(body.level3_approver_id) : null,
      });

      return NextResponse.json({
        success: true,
        message: "Standard HR & Mayor approvers successfully applied across departments",
      });
    }

    // Standard single-approver assignment
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
