import { NextRequest, NextResponse } from "next/server";

import { dFetch } from "@/modules/human-resource-management/shared/utils/directus";
import {
  UpdateOnboardingProfileSchema,
  type OnboardingProfile,
  type OnboardingStatus,
} from "@/modules/human-resource-management/onboarding/hub/types/onboarding-profile.schema";
import {
  checkTransition,
  evidenceFromProfile,
  isKnownStatus,
} from "@/modules/human-resource-management/onboarding/hub/statusMachine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/hrm/onboarding/profiles/[id] — single profile (404 when absent).
// PATCH /api/hrm/onboarding/profiles/[id] — partial update; `status` moves
// through the machine: unknown stage → 400, skip-ahead → 400,
// predicate-false → 400 with reason. current_stage mirrors status unless
// HR pins it explicitly.

function getPhilippineTime(): string {
  return new Date().toLocaleString("sv-SE", { timeZone: "Asia/Manila" });
}

function validationFailed(errors: Record<string, string[]>) {
  return NextResponse.json(
    { success: false, message: "Validation failed", errors },
    { status: 400 }
  );
}

function toBool(value: unknown): boolean {
  return value === true || value === 1 || value === "1";
}

function normalize(row: Record<string, unknown>): OnboardingProfile {
  return {
    ...(row as object),
    offer_accepted: toBool(row["offer_accepted"]),
  } as OnboardingProfile;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const profileId = Number(id);
    if (!Number.isInteger(profileId) || profileId <= 0) {
      return NextResponse.json(
        { success: false, message: "Invalid profile id" },
        { status: 400 }
      );
    }

    const result = (await dFetch(
      `/items/onboarding_profiles/${profileId}`
    )) as { data?: Record<string, unknown> };
    if (!result?.data) {
      return NextResponse.json(
        { success: false, message: "Profile not found" },
        { status: 404 }
      );
    }
    return NextResponse.json({ success: true, data: normalize(result.data) });
  } catch (error) {
    console.error("[onboarding-profiles] fetch error:", error);
    return NextResponse.json(
      { success: false, message: "An unexpected error occurred. Please try again later." },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const profileId = Number(id);
    if (!Number.isInteger(profileId) || profileId <= 0) {
      return NextResponse.json(
        { success: false, message: "Invalid profile id" },
        { status: 400 }
      );
    }

    const body: unknown = await req.json().catch(() => null);
    const validation = UpdateOnboardingProfileSchema.safeParse(body);
    if (!validation.success) {
      return validationFailed(validation.error.flatten().fieldErrors);
    }

    const current = (await dFetch(
      `/items/onboarding_profiles/${profileId}`
    )) as { data?: Record<string, unknown> };
    if (!current?.data) {
      return NextResponse.json(
        { success: false, message: "Profile not found" },
        { status: 404 }
      );
    }
    const profile = normalize(current.data);

    const patch: Record<string, unknown> = {};
    const data = validation.data;
    if (data.application_id !== undefined) patch["application_id"] = data.application_id;
    if (data.offer_accepted !== undefined) patch["offer_accepted"] = data.offer_accepted;
    if (data.start_date !== undefined) patch["start_date"] = data.start_date;

    if (data.status !== undefined) {
      if (!isKnownStatus(data.status)) {
        return NextResponse.json(
          { success: false, message: `Unknown stage: ${String(data.status)}` },
          { status: 400 }
        );
      }
      const target = data.status as OnboardingStatus;
      const effective: OnboardingProfile = {
        ...profile,
        offer_accepted: data.offer_accepted ?? profile.offer_accepted,
      };
      const gate = checkTransition(
        profile.status,
        target,
        evidenceFromProfile(effective)
      );
      if (!gate.ok) {
        return NextResponse.json(
          { success: false, message: gate.reason },
          { status: 400 }
        );
      }
      patch["status"] = target;
      if (data.current_stage === undefined) patch["current_stage"] = target;
    }
    if (data.current_stage !== undefined) patch["current_stage"] = data.current_stage;

    patch["updated_at"] = getPhilippineTime();

    const updated = (await dFetch(`/items/onboarding_profiles/${profileId}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    })) as { data?: Record<string, unknown> };

    return NextResponse.json({
      success: true,
      data: updated?.data ? normalize(updated.data) : null,
    });
  } catch (error) {
    console.error("[onboarding-profiles] update error:", error);
    return NextResponse.json(
      { success: false, message: "An unexpected error occurred. Please try again later." },
      { status: 500 }
    );
  }
}
