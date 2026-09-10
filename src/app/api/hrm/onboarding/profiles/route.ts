import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { dFetch } from "@/modules/human-resource-management/shared/utils/directus";
import { dispatchMail } from "@/modules/human-resource-management/recruitment/mailing/utils/dispatchMail";
import { logRedacted } from "@/modules/human-resource-management/recruitment/mailing/utils/mailLog";
import { buildOnboardingDispatchCtx } from "@/modules/human-resource-management/onboarding/completion/completionChecklist";
import {
  CreateOnboardingProfileSchema,
  type OnboardingProfile,
} from "@/modules/human-resource-management/onboarding/hub/types/onboarding-profile.schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/hrm/onboarding/profiles — list (+ `?employee_id=` filter so the
// hub and the Todo 2 hook shape share one read path).
// POST /api/hrm/onboarding/profiles — create; hook shape `{ employee_id }`
// enters FOR_ONBOARDING with offer_accepted false; HR may attach the
// offer-acceptance record (offer_accepted + start_date + application_id).

function getPhilippineTime(): string {
  return new Date().toLocaleString("sv-SE", { timeZone: "Asia/Manila" });
}

function validationFailed(errors: Record<string, string[]>) {
  return NextResponse.json(
    { success: false, message: "Validation failed", errors },
    { status: 400 }
  );
}

// Directus reads booleans back as 0/1 — normalize to real booleans so the
// envelope always matches OnboardingProfileSchema (Todo 2 gotcha, kept).
function normalize(row: Record<string, unknown>): OnboardingProfile {
  const value = row["offer_accepted"];
  return {
    ...(row as object),
    offer_accepted: value === true || value === 1 || value === "1",
  } as OnboardingProfile;
}

const listQuerySchema = z
  .object({
    employee_id: z.coerce.number().int().positive().optional(),
  })
  .strict();

export async function GET(req: NextRequest) {
  try {
    const params = Object.fromEntries(req.nextUrl.searchParams.entries());
    const query = listQuerySchema.safeParse(params);
    if (!query.success) {
      return validationFailed(query.error.flatten().fieldErrors);
    }

    const filter = query.data.employee_id
      ? `?filter[employee_id][_eq]=${query.data.employee_id}`
      : "?limit=100";
    const result = (await dFetch(`/items/onboarding_profiles${filter}`)) as {
      data?: OnboardingProfile[];
    };
    return NextResponse.json({ success: true, data: result?.data ?? [] });
  } catch (error) {
    console.error("[onboarding-profiles] list error:", error);
    return NextResponse.json(
      { success: false, message: "An unexpected error occurred. Please try again later." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body: unknown = await req.json().catch(() => null);
    const validation = CreateOnboardingProfileSchema.safeParse(body);
    if (!validation.success) {
      return validationFailed(validation.error.flatten().fieldErrors);
    }

    const { employee_id } = validation.data;

    const existing = (await dFetch(
      `/items/onboarding_profiles?filter[employee_id][_eq]=${employee_id}&fields=id&limit=1`
    )) as { data?: unknown[] };
    if (Array.isArray(existing?.data) && existing.data.length > 0) {
      return NextResponse.json(
        { success: false, message: "A profile already exists for this employee" },
        { status: 409 }
      );
    }

    const now = getPhilippineTime();
    const created = (await dFetch("/items/onboarding_profiles", {
      method: "POST",
      body: JSON.stringify({
        employee_id,
        application_id: validation.data.application_id ?? null,
        status: "FOR_ONBOARDING",
        current_stage: validation.data.current_stage ?? null,
        offer_accepted: validation.data.offer_accepted ?? false,
        start_date: validation.data.start_date ?? null,
        created_at: now,
        updated_at: now,
      }),
    })) as { data?: OnboardingProfile };

    const createdProfile = created?.data
      ? normalize(created.data as unknown as Record<string, unknown>)
      : null;

    // Stage notify (Todo 14 approve branch): the profile-created transition
    // is committed above — never awaited, never throws (interviews-route
    // void precedent). Dedup key `<profile_id>:<transition>`.
    if (createdProfile) {
      void dispatchMail(
        "onboarding.profile_created",
        buildOnboardingDispatchCtx(
          {
            id: createdProfile.id,
            employee_id: createdProfile.employee_id,
            application_id: createdProfile.application_id,
          },
          "onboarding.profile_created",
          createdProfile.status
        )
      ).catch(logRedacted);
    }

    return NextResponse.json(
      {
        success: true,
        data: createdProfile,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[onboarding-profiles] create error:", error);
    return NextResponse.json(
      { success: false, message: "An unexpected error occurred. Please try again later." },
      { status: 500 }
    );
  }
}
