import { NextRequest, NextResponse } from "next/server";

import { dFetch } from "@/modules/human-resource-management/shared/utils/directus";
import { dispatchMail } from "@/modules/human-resource-management/recruitment/mailing/utils/dispatchMail";
import { logRedacted } from "@/modules/human-resource-management/recruitment/mailing/utils/mailLog";
import { buildOnboardingDispatchCtx } from "@/modules/human-resource-management/onboarding/completion/completionChecklist";
import type { OnboardingProfile } from "@/modules/human-resource-management/onboarding/hub/types/onboarding-profile.schema";
import {
  checkTransition,
  emptyEvidence,
} from "@/modules/human-resource-management/onboarding/hub/statusMachine";
import type { AcknowledgementLog } from "@/modules/human-resource-management/onboarding/verification/types/acknowledgement-log.schema";
import {
  aggregateQueue,
  buildReturnMarker,
  parseReturnMarker,
  VerificationDecisionSchema,
} from "@/modules/human-resource-management/onboarding/verification/types/verification-queue.schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// verifications — HR verification queue over `onboarding_profiles`.
//
// GET — queue read: profiles in DOCUMENTS_SUBMITTED (pending/returned) +
// HR_VERIFIED (approved history), aggregated with return-marker parse and
// per-profile ack status (per-recipient status port). Vault is READ-NEVER here
// (Todo 8 owns it); ack logs are joined read-only from the separate store.
// POST — one decision per call: approve | return(reason) | resubmit.
// Cycle: pending → approved; pending → returned(reason) → resubmit → pending
// → approved. Approve from returned is refused (resubmit first).
//
// Predicate ownership: Todo 10 owns the DOCUMENTS_SUBMITTED done-predicate —
// the HR approve decision IS the verification evidence, so this route
// machine-checks with documentsVerified:true then PATCHes via dFetch. Todo 5
// schema/routes stay frozen (never imported for mutation here).

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

function normalizeProfile(row: Record<string, unknown>): OnboardingProfile {
  return {
    ...(row as object),
    offer_accepted: toBool(row["offer_accepted"]),
  } as OnboardingProfile;
}

export async function GET() {
  try {
    const profilesResult = (await dFetch(
      "/items/onboarding_profiles?filter[status][_in]=DOCUMENTS_SUBMITTED,HR_VERIFIED&limit=100"
    )) as { data?: Record<string, unknown>[] };
    const profiles = (Array.isArray(profilesResult?.data)
      ? profilesResult.data
      : []
    ).map(normalizeProfile);

    const logsResult = (await dFetch(
      `/items/acknowledgement_logs?filter[doc_ref][_contains]=${encodeURIComponent("onboarding:profile:")}&fields=doc_ref,signer,acknowledged_at,method&limit=500`
    )) as { data?: AcknowledgementLog[] };
    const logs = Array.isArray(logsResult?.data) ? logsResult.data : [];

    return NextResponse.json({ success: true, data: aggregateQueue(profiles, logs) });
  } catch (error) {
    console.error("[onboarding-verifications] queue error:", error);
    return NextResponse.json(
      { success: false, message: "An unexpected error occurred. Please try again later." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body: unknown = await req.json().catch(() => null);
    const validation = VerificationDecisionSchema.safeParse(body);
    if (!validation.success) {
      return validationFailed(validation.error.flatten().fieldErrors);
    }

    const { profile_id: profileId, decision } = validation.data;
    const current = (await dFetch(
      `/items/onboarding_profiles/${profileId}`
    )) as { data?: Record<string, unknown> };
    if (!current?.data) {
      return NextResponse.json(
        { success: false, message: "Profile not found" },
        { status: 404 }
      );
    }
    const profile = normalizeProfile(current.data);

    if (profile.status !== "DOCUMENTS_SUBMITTED") {
      return NextResponse.json(
        {
          success: false,
          message: `Profile is ${profile.status} — only DOCUMENTS_SUBMITTED rows can be verified`,
        },
        { status: 400 }
      );
    }

    const marker = parseReturnMarker(profile.current_stage);
    const now = getPhilippineTime();

    if (decision === "approve") {
      if (marker.returned) {
        return NextResponse.json(
          {
            success: false,
            message: "Document was returned for resubmit — resubmit is required before approval",
          },
          { status: 400 }
        );
      }
      // The HR approve decision IS the verification evidence (Todo 10 owns
      // the DOCUMENTS_SUBMITTED predicate): single forward step + predicate
      // true by decision, so the gate passes and the profile advances.
      const gate = checkTransition(profile.status, "HR_VERIFIED", {
        ...emptyEvidence(),
        offerAccepted: profile.offer_accepted === true,
        documentsVerified: true,
      });
      if (!gate.ok) {
        return NextResponse.json(
          { success: false, message: gate.reason },
          { status: 400 }
        );
      }
      const updated = (await dFetch(`/items/onboarding_profiles/${profileId}`, {
        method: "PATCH",
        body: JSON.stringify({
          status: "HR_VERIFIED",
          current_stage: "HR_VERIFIED",
          updated_at: now,
        }),
      })) as { data?: Record<string, unknown> };
      if (!updated?.data) {
        console.error("[onboarding-verifications] approve patch: no data");
        return NextResponse.json(
          { success: false, message: "An unexpected error occurred. Please try again later." },
          { status: 500 }
        );
      }
      // Stage notify (Todo 14 approve branch): the docs-verified transition
      // is committed above — never awaited, never throws. Dedup key
      // `<profile_id>:<transition>`.
      void dispatchMail(
        "onboarding.docs_verified",
        buildOnboardingDispatchCtx(
          {
            id: profileId,
            employee_id: profile.employee_id,
            application_id: profile.application_id,
          },
          "onboarding.docs_verified",
          "HR_VERIFIED"
        )
      ).catch(logRedacted);
      return NextResponse.json({
        success: true,
        data: normalizeProfile(updated.data),
        message: "Documents approved",
      });
    }

    if (decision === "return") {
      const reason = (validation.data.reason ?? "").trim();
      const updated = (await dFetch(`/items/onboarding_profiles/${profileId}`, {
        method: "PATCH",
        body: JSON.stringify({
          current_stage: buildReturnMarker(reason),
          updated_at: now,
        }),
      })) as { data?: Record<string, unknown> };
      if (!updated?.data) {
        console.error("[onboarding-verifications] return patch: no data");
        return NextResponse.json(
          { success: false, message: "An unexpected error occurred. Please try again later." },
          { status: 500 }
        );
      }
      return NextResponse.json({
        success: true,
        data: normalizeProfile(updated.data),
        message: "Returned for resubmit with reason",
      });
    }

    // resubmit: clears the return marker — the row re-queues as pending.
    // Status never regressed (machine is forward-only), so clearing the
    // marker IS the re-queue.
    if (!marker.returned) {
      return NextResponse.json(
        { success: false, message: "Profile was not returned — nothing to resubmit" },
        { status: 400 }
      );
    }
    const updated = (await dFetch(`/items/onboarding_profiles/${profileId}`, {
      method: "PATCH",
      body: JSON.stringify({
        current_stage: "DOCUMENTS_SUBMITTED",
        updated_at: now,
      }),
    })) as { data?: Record<string, unknown> };
    if (!updated?.data) {
      console.error("[onboarding-verifications] resubmit patch: no data");
      return NextResponse.json(
        { success: false, message: "An unexpected error occurred. Please try again later." },
        { status: 500 }
      );
    }
    return NextResponse.json({
      success: true,
      data: normalizeProfile(updated.data),
      message: "Resubmitted — back in the pending queue",
    });
  } catch (error) {
    console.error("[onboarding-verifications] decision error:", error);
    return NextResponse.json(
      { success: false, message: "An unexpected error occurred. Please try again later." },
      { status: 500 }
    );
  }
}
