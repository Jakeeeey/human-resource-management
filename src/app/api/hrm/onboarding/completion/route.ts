import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { dFetch } from "@/modules/human-resource-management/shared/utils/directus";
import { dispatchMail } from "@/modules/human-resource-management/recruitment/mailing/utils/dispatchMail";
import { logRedacted } from "@/modules/human-resource-management/recruitment/mailing/utils/mailLog";
import { loadServerEquipmentCatalog } from "@/modules/human-resource-management/onboarding/equipment/server/equipmentCatalogServer";
import { isOrientationDone } from "@/modules/human-resource-management/onboarding/orientation/orientationStore";
import {
  buildOnboardingDispatchCtx,
  isCompletionReady,
  missingChecklistItems,
  runCompletionChecklist,
  type CompletionInputs,
  type ChecklistItem,
} from "@/modules/human-resource-management/onboarding/completion/completionChecklist";
import type { OnboardingProfile } from "@/modules/human-resource-management/onboarding/hub/types/onboarding-profile.schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/hrm/onboarding/completion — the §10 completion orchestrator
// (Todo 14). Verifies the full checklist in fixed order (docs, HR verify,
// profile, access, equipment, orientations, training, ack) and writes the
// final ONBOARDING_COMPLETED status.
//
// - SINGLE WRITER: this route is the only writer of ONBOARDING_COMPLETED
//   (hub Completion tab + clients call here; the profiles PATCH route never
//   targets the terminal state — the machine's single-step flow ends at
//   FULLY_EQUIPPED, and this orchestrator takes the final step).
// - RE-CHECKABLE: GET re-reads the checklist without writing; POST on an
//   already-completed hire returns success with `alreadyCompleted: true`
//   (no rewrite, no re-notify — the re-fire collapses).
// - NEVER PARTIAL-WRITE: every evidence read completes BEFORE the single
//   PATCH. A refused hire (422 + missing-item list) writes nothing and
//   notifies nothing.
// - NOTIFY ONLY ON COMMIT: `void dispatchMail("onboarding.completed", …)`
//   fires after the PATCH returns data, never on failure paths. MAIL_DRY_RUN
//   governs real sends (static + dry-run asserts only — see evidence).

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

const profileQuerySchema = z
  .object({
    profile_id: z.coerce.number().int().positive(),
  })
  .strict();

const completeBodySchema = z
  .object({
    profile_id: z.coerce.number().int().positive(),
  })
  .strict();

interface AckLogRow {
  doc_ref?: unknown;
}

interface TrainingRow {
  status?: unknown;
}

function ackNamespaceCount(rows: AckLogRow[], profileId: number): number {
  const prefix = `onboarding:profile:${profileId}`;
  let count = 0;
  for (const row of rows) {
    const ref = row.doc_ref;
    if (typeof ref !== "string") continue;
    // Exact-namespace match only: `onboarding:profile:1` must not match
    // profile 10/11 (`===` or `:`-suffixed, never bare prefix).
    if (ref === prefix || ref.startsWith(`${prefix}:`)) count += 1;
  }
  return count;
}

async function gatherChecklist(
  profile: OnboardingProfile
): Promise<{ items: ChecklistItem[] } | { error: string }> {
  let catalog: { key: string; required: boolean }[];
  try {
    const loaded = await loadServerEquipmentCatalog();
    catalog = loaded.map((entry) => ({ key: entry.key, required: entry.required }));
  } catch (error) {
    console.error("[onboarding-completion] catalog error:", error);
    return { error: "Equipment catalog is misconfigured" };
  }

  let equipmentDocRefs: unknown[] = [];
  let trainingStatuses: string[] = [];
  let ackCount = 0;
  try {
    const [issues, acks, training, profileAcks] = await Promise.all([
      dFetch(
        `/items/acknowledgement_logs?filter[doc_ref][_contains]=${encodeURIComponent(`equipment:issue:${profile.id}:`)}&fields=doc_ref&limit=200`
      ) as Promise<{ data?: AckLogRow[] }>,
      dFetch(
        `/items/acknowledgement_logs?filter[doc_ref][_contains]=${encodeURIComponent(`equipment:ack:${profile.id}:`)}&fields=doc_ref&limit=200`
      ) as Promise<{ data?: AckLogRow[] }>,
      dFetch(
        `/items/training_assignments?filter[profile_id][_eq]=${profile.id}&fields=status&limit=100`
      ) as Promise<{ data?: TrainingRow[] }>,
      dFetch(
        `/items/acknowledgement_logs?filter[doc_ref][_contains]=${encodeURIComponent(`onboarding:profile:${profile.id}`)}&fields=doc_ref&limit=200`
      ) as Promise<{ data?: AckLogRow[] }>,
    ]);
    const issueRows = Array.isArray(issues?.data) ? issues.data : [];
    const ackRows = Array.isArray(acks?.data) ? acks.data : [];
    equipmentDocRefs = [...issueRows, ...ackRows].map((row) => row.doc_ref);
    const trainingRows = Array.isArray(training?.data) ? training.data : [];
    trainingStatuses = trainingRows.map((row) =>
      typeof row.status === "string" ? row.status : ""
    );
    const profileAckRows = Array.isArray(profileAcks?.data) ? profileAcks.data : [];
    ackCount = ackNamespaceCount(profileAckRows, profile.id);
  } catch (error) {
    console.error("[onboarding-completion] evidence error:", error);
    return { error: "Completion evidence is temporarily unavailable" };
  }

  const input: CompletionInputs = {
    profile: {
      id: profile.id,
      employee_id: profile.employee_id,
      application_id: profile.application_id,
      status: profile.status,
      current_stage: profile.current_stage,
      offer_accepted: profile.offer_accepted,
    },
    equipmentDocRefs,
    equipmentCatalog: catalog,
    orientationDone: isOrientationDone(profile.id),
    trainingStatuses,
    ackCount,
  };
  return { items: runCompletionChecklist(input) };
}

// GET /api/hrm/onboarding/completion?profile_id= — re-check without writing.
export async function GET(req: NextRequest) {
  try {
    const params = Object.fromEntries(req.nextUrl.searchParams.entries());
    const query = profileQuerySchema.safeParse(params);
    if (!query.success) {
      return validationFailed(query.error.flatten().fieldErrors);
    }

    const current = (await dFetch(
      `/items/onboarding_profiles/${query.data.profile_id}`
    )) as { data?: Record<string, unknown> };
    if (!current?.data) {
      return NextResponse.json(
        { success: false, message: "Profile not found" },
        { status: 404 }
      );
    }
    const profile = normalizeProfile(current.data);

    const gathered = await gatherChecklist(profile);
    if ("error" in gathered) {
      return NextResponse.json(
        { success: false, message: gathered.error },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        profile,
        checklist: gathered.items,
        ready: isCompletionReady(gathered.items),
        missing: missingChecklistItems(gathered.items),
      },
    });
  } catch (error) {
    console.error("[onboarding-completion] check error:", error);
    return NextResponse.json(
      { success: false, message: "An unexpected error occurred. Please try again later." },
      { status: 500 }
    );
  }
}

// POST /api/hrm/onboarding/completion — verify-all-first, then one write.
export async function POST(req: NextRequest) {
  try {
    const body: unknown = await req.json().catch(() => null);
    const validation = completeBodySchema.safeParse(body);
    if (!validation.success) {
      return validationFailed(validation.error.flatten().fieldErrors);
    }
    const profileId = validation.data.profile_id;

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

    // Re-fire collapses: already terminal → success, no rewrite, no notify.
    if (profile.status === "ONBOARDING_COMPLETED") {
      const gathered = await gatherChecklist(profile);
      if ("error" in gathered) {
        return NextResponse.json(
          { success: false, message: gathered.error },
          { status: 500 }
        );
      }
      return NextResponse.json({
        success: true,
        data: {
          profile,
          checklist: gathered.items,
          ready: true,
          missing: [],
        },
        message: "Onboarding already completed",
        alreadyCompleted: true,
      });
    }

    // Machine integrity: the orchestrator takes exactly the final step
    // FULLY_EQUIPPED → ONBOARDING_COMPLETED (single forward step, like every
    // other transition). Earlier statuses drive forward through the hub first.
    if (profile.status !== "FULLY_EQUIPPED") {
      const gathered = await gatherChecklist(profile);
      if ("error" in gathered) {
        return NextResponse.json(
          { success: false, message: gathered.error },
          { status: 500 }
        );
      }
      return NextResponse.json(
        {
          success: false,
          message: `Profile is ${profile.status} — drive status to FULLY_EQUIPPED first`,
          checklist: gathered.items,
          missing: missingChecklistItems(gathered.items),
        },
        { status: 422 }
      );
    }

    const gathered = await gatherChecklist(profile);
    if ("error" in gathered) {
      return NextResponse.json(
        { success: false, message: gathered.error },
        { status: 500 }
      );
    }

    const missing = missingChecklistItems(gathered.items);
    if (missing.length > 0) {
      // Refused with the missing-item list — nothing written, nothing sent.
      return NextResponse.json(
        {
          success: false,
          message: `Completion blocked: ${missing.length} checklist item(s) still open`,
          checklist: gathered.items,
          missing,
        },
        { status: 422 }
      );
    }

    // All §10 items pass — the single write (never partial: this is the only
    // PATCH on this path, after every read above completed).
    const now = getPhilippineTime();
    const updated = (await dFetch(`/items/onboarding_profiles/${profileId}`, {
      method: "PATCH",
      body: JSON.stringify({
        status: "ONBOARDING_COMPLETED",
        current_stage: "ONBOARDING_COMPLETED",
        updated_at: now,
      }),
    })) as { data?: Record<string, unknown> };
    if (!updated?.data) {
      console.error("[onboarding-completion] final patch: no data");
      return NextResponse.json(
        { success: false, message: "An unexpected error occurred. Please try again later." },
        { status: 500 }
      );
    }
    const completed = normalizeProfile(updated.data);

    // Notify ONLY on the committed transition (Todo 1c approve branch —
    // veto design stays documented-but-dead). Never awaited, never throws.
    void dispatchMail(
      "onboarding.completed",
      buildOnboardingDispatchCtx(
        {
          id: completed.id,
          employee_id: completed.employee_id,
          application_id: completed.application_id,
        },
        "onboarding.completed",
        completed.status
      )
    ).catch(logRedacted);

    return NextResponse.json({
      success: true,
      data: {
        profile: completed,
        checklist: gathered.items,
        ready: true,
        missing: [],
      },
      message: "Onboarding completed",
    });
  } catch (error) {
    console.error("[onboarding-completion] complete error:", error);
    return NextResponse.json(
      { success: false, message: "An unexpected error occurred. Please try again later." },
      { status: 500 }
    );
  }
}
