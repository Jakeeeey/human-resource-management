import { NextResponse } from "next/server";
import { companyProfileService } from "@/modules/human-resource-management/employee-admin/structrure/company-profile/services/company-profile";
import { CompanyProfileSchema } from "@/modules/human-resource-management/employee-admin/structrure/company-profile/types/company-profile.schema";

/**
 * Standardized API error handler
 */
function handleApiError(error: unknown) {
    const errorInfo = error as { message?: string };
    console.error("API Error:", error);

    let status = 500;
    if (errorInfo.message?.includes("VALIDATION_FAILED")) {
        status = 400;
    } else if (errorInfo.message?.includes("DB_NOT_FOUND")) {
        status = 404;
    }

    return NextResponse.json(
        { error: errorInfo.message || "Internal Server Error" },
        { status }
    );
}

/**
 * GET: Fetch company profile
 */
export async function GET() {
    try {
        const data = await companyProfileService.fetchProfile();
        return NextResponse.json({ data });
    } catch (error) {
        return handleApiError(error);
    }
}

/**
 * PATCH: Update company profile
 */
export async function PATCH(request: Request) {
    try {
        const body = await request.json();

        // Validate payload
        const validatedData = CompanyProfileSchema.partial().parse(body);

        if (!validatedData.company_id) {
            throw new Error("VALIDATION_FAILED: company_id is required for update");
        }

        const { company_id, ...updateData } = validatedData;
        const result = await companyProfileService.updateProfile(company_id, updateData);

        return NextResponse.json({ data: result });
    } catch (error) {
        return handleApiError(error);
    }
}
