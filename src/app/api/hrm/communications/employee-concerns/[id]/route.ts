import { NextResponse } from "next/server";
import { employeeConcernService } from "@/modules/human-resource-management/communications/employee-concerns/services/employee-concern";
import { EmployeeConcernStatusSchema } from "@/modules/human-resource-management/communications/employee-concerns/types/employee-concern.schema";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function handleApiError(error: unknown) {
    const errorInfo = error as { message?: string };
    console.error("Employee Concern [id] API Error:", error);
    const status = errorInfo.message?.includes("VALIDATION_FAILED") ? 400 : 500;
    return NextResponse.json(
        { error: errorInfo.message || "Internal Server Error" },
        { status }
    );
}

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: idStr } = await params;
        const id = parseInt(idStr);
        if (Number.isNaN(id)) {
            return NextResponse.json({ error: "Invalid id" }, { status: 400 });
        }

        const body = await request.json();
        const validated = EmployeeConcernStatusSchema.parse(body);

        await employeeConcernService.updateStatus(id, validated.status);
        return NextResponse.json({ success: true });
    } catch (error) {
        return handleApiError(error);
    }
}

export async function DELETE(
    _request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: idStr } = await params;
        const id = parseInt(idStr);
        if (Number.isNaN(id)) {
            return NextResponse.json({ error: "Invalid id" }, { status: 400 });
        }

        await employeeConcernService.remove(id);
        return NextResponse.json({ success: true });
    } catch (error) {
        return handleApiError(error);
    }
}
