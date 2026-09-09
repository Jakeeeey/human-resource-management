import { NextRequest, NextResponse } from "next/server";

import { dFetch } from "@/modules/human-resource-management/shared/utils/directus";
import { loadServerEquipmentCatalog } from "@/modules/human-resource-management/onboarding/equipment/server/equipmentCatalogServer";
import {
  buildEquipmentItemStates,
  isFullyEquipped,
  parseEquipmentDocRef,
} from "@/modules/human-resource-management/onboarding/equipment/equipmentPredicate";
import { EquipmentQuerySchema } from "@/modules/human-resource-management/onboarding/equipment/types/equipment-issue.schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/hrm/onboarding/equipment-status?profile_id= — per-item issue/ack
// state for one hire plus the FULLY_EQUIPPED verdict. This is the plug point
// for Todo 5's StageEvidence (`equipmentDone`) and Todo 14's orchestrator:
// both read `fullyEquipped` here instead of re-deriving it.

function validationFailed(errors: Record<string, string[]>) {
  return NextResponse.json(
    { success: false, message: "Validation failed", errors },
    { status: 400 }
  );
}

interface AckLogRow {
  id?: number;
  doc_ref?: string;
  signer?: string;
  acknowledged_at?: string;
  method?: string;
}

export async function GET(req: NextRequest) {
  try {
    const params = Object.fromEntries(req.nextUrl.searchParams.entries());
    const query = EquipmentQuerySchema.safeParse(params);
    if (!query.success) {
      return validationFailed(query.error.flatten().fieldErrors);
    }
    const profileId = query.data.profile_id;

    let catalog;
    try {
      catalog = await loadServerEquipmentCatalog();
    } catch (error) {
      console.error("[onboarding-equipment-status] catalog error:", error);
      return NextResponse.json(
        { success: false, message: "Equipment catalog is misconfigured" },
        { status: 500 }
      );
    }

    const [issues, acks] = await Promise.all([
      dFetch(
        `/items/acknowledgement_logs?filter[doc_ref][_contains]=${encodeURIComponent(`equipment:issue:${profileId}:`)}&limit=100`
      ) as Promise<{ data?: AckLogRow[] }>,
      dFetch(
        `/items/acknowledgement_logs?filter[doc_ref][_contains]=${encodeURIComponent(`equipment:ack:${profileId}:`)}&limit=100`
      ) as Promise<{ data?: AckLogRow[] }>,
    ]);
    const issueRows = Array.isArray(issues?.data) ? issues.data : [];
    const ackRows = Array.isArray(acks?.data) ? acks.data : [];

    const byItem = new Map<
      string,
      { issue: AckLogRow | null; ack: AckLogRow | null }
    >();
    for (const row of issueRows) {
      const parsed = parseEquipmentDocRef(row.doc_ref);
      if (!parsed || parsed.profileId !== profileId) continue;
      const slot = byItem.get(parsed.itemKey) ?? { issue: null, ack: null };
      slot.issue = row;
      byItem.set(parsed.itemKey, slot);
    }
    for (const row of ackRows) {
      const parsed = parseEquipmentDocRef(row.doc_ref);
      if (!parsed || parsed.profileId !== profileId) continue;
      const slot = byItem.get(parsed.itemKey) ?? { issue: null, ack: null };
      const prevAt = slot.ack?.acknowledged_at ?? "";
      const nextAt = row.acknowledged_at ?? "";
      if (!slot.ack || nextAt >= prevAt) slot.ack = row;
      byItem.set(parsed.itemKey, slot);
    }

    const docRefs = [...issueRows, ...ackRows].map((r) => r.doc_ref);
    const states = buildEquipmentItemStates(
      profileId,
      catalog.map((c) => ({ key: c.key, required: c.required })),
      docRefs
    );

    const items = catalog.map((entry) => {
      const slot = byItem.get(entry.key);
      const state = states.find((s) => s.itemKey === entry.key);
      return {
        key: entry.key,
        label: entry.label,
        issuer: entry.issuer,
        required: entry.required,
        source: entry.source,
        issued: state?.issued ?? false,
        issuedAt: slot?.issue?.acknowledged_at ?? null,
        issuedBy: slot?.issue?.signer ?? null,
        acked: state?.acked ?? false,
        ackedAt: slot?.ack?.acknowledged_at ?? null,
        ackedBy: slot?.ack?.signer ?? null,
        ackMethod: slot?.ack?.method ?? null,
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        profileId,
        items,
        fullyEquipped: isFullyEquipped(states),
      },
    });
  } catch (error) {
    console.error("[onboarding-equipment-status] status error:", error);
    return NextResponse.json(
      { success: false, message: "An unexpected error occurred. Please try again later." },
      { status: 500 }
    );
  }
}
