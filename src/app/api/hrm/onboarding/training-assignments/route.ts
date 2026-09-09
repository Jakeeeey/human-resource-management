import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { dFetch } from "@/modules/human-resource-management/shared/utils/directus";
import {
  CreateTrainingAssignmentSchema,
  type TrainingTakingAssignment,
} from "@/modules/human-resource-management/onboarding/training/types/training-taking.schema";
import {
  normalizeTrainingAssignment,
  getPhilippineTime,
} from "@/modules/human-resource-management/onboarding/training/trainingTaking";
import { resolveApplicationBridge } from "@/modules/human-resource-management/onboarding/training/trainingAssignmentAdapter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/hrm/onboarding/training-assignments — list (+ `?profile_id=`,
// `?employee_id=`, `?status=` filters so the hiree taking view and the HR
// overview share one read path).
// POST /api/hrm/onboarding/training-assignments — HR assigns a quiz to a
// hire: `{ profile_id, employee_id, quiz_id, due?, application_id? }`.
// The `application_id` bridge resolves HR-explicit first, else the
// hook-stored onboarding-profile value, else null (never spoofed — the
// Todo 4 adapter's `resolveApplicationBridge`). New rows open `assigned`
// with `opened_at` set server-side (PH time).

function validationFailed(errors: Record<string, string[]>) {
  return NextResponse.json(
    { success: false, message: "Validation failed", errors },
    { status: 400 }
  );
}

const listQuerySchema = z
  .object({
    profile_id: z.coerce.number().int().positive().optional(),
    employee_id: z.coerce.number().int().positive().optional(),
    status: z.enum(["assigned", "in_progress", "completed"]).optional(),
  })
  .strict();

export async function GET(req: NextRequest) {
  try {
    const params = Object.fromEntries(req.nextUrl.searchParams.entries());
    const query = listQuerySchema.safeParse(params);
    if (!query.success) {
      return validationFailed(query.error.flatten().fieldErrors);
    }

    const filters: string[] = [];
    if (query.data.profile_id !== undefined) {
      filters.push(`filter[profile_id][_eq]=${query.data.profile_id}`);
    }
    if (query.data.employee_id !== undefined) {
      filters.push(`filter[employee_id][_eq]=${query.data.employee_id}`);
    }
    if (query.data.status !== undefined) {
      filters.push(`filter[status][_eq]=${query.data.status}`);
    }
    const suffix = filters.length > 0 ? `?${filters.join("&")}&limit=100` : "?limit=100";
    const result = (await dFetch(`/items/training_assignments${suffix}`)) as {
      data?: Record<string, unknown>[];
    };
    const rows = Array.isArray(result?.data) ? result.data : [];
    return NextResponse.json({
      success: true,
      data: rows.map(normalizeTrainingAssignment),
    });
  } catch (error) {
    console.error("[onboarding-training-assignments] list error:", error);
    return NextResponse.json(
      { success: false, message: "An unexpected error occurred. Please try again later." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body: unknown = await req.json().catch(() => null);
    const validation = CreateTrainingAssignmentSchema.safeParse(body);
    if (!validation.success) {
      return validationFailed(validation.error.flatten().fieldErrors);
    }

    const { profile_id, employee_id, quiz_id, due } = validation.data;

    // Bridge: explicit HR link first, else the hook-stored profile value,
    // else null (never fabricated).
    let profileApplicationId: number | null = null;
    try {
      const profile = (await dFetch(`/items/onboarding_profiles/${profile_id}`)) as {
        data?: Record<string, unknown>;
      };
      const raw = profile?.data?.["application_id"];
      profileApplicationId =
        typeof raw === "number" && Number.isInteger(raw) && raw > 0 ? raw : null;
    } catch {
      profileApplicationId = null;
    }
    const applicationId = resolveApplicationBridge(
      { application_id: profileApplicationId },
      validation.data.application_id ?? null
    );

    const now = getPhilippineTime();
    const created = (await dFetch("/items/training_assignments", {
      method: "POST",
      body: JSON.stringify({
        profile_id,
        employee_id,
        quiz_id,
        application_id: applicationId,
        due: due ?? null,
        opened_at: now,
        status: "assigned",
        completed_ref: null,
        created_at: now,
        updated_at: now,
      }),
    })) as { data?: Record<string, unknown> };

    const data: TrainingTakingAssignment | null = created?.data
      ? normalizeTrainingAssignment(created.data)
      : null;
    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (error) {
    console.error("[onboarding-training-assignments] create error:", error);
    return NextResponse.json(
      { success: false, message: "An unexpected error occurred. Please try again later." },
      { status: 500 }
    );
  }
}
