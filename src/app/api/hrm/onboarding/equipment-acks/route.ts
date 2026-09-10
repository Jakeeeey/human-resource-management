import { NextRequest, NextResponse } from "next/server";

import { dFetch } from "@/modules/human-resource-management/shared/utils/directus";
import { loadServerEquipmentCatalog } from "@/modules/human-resource-management/onboarding/equipment/server/equipmentCatalogServer";
import { findCatalogItem } from "@/modules/human-resource-management/onboarding/equipment/equipmentCatalog";
import { equipmentDocRef } from "@/modules/human-resource-management/onboarding/equipment/equipmentPredicate";
import { AcknowledgeEquipmentItemSchema } from "@/modules/human-resource-management/onboarding/equipment/types/equipment-issue.schema";
import { EquipmentQuerySchema } from "@/modules/human-resource-management/onboarding/equipment/types/equipment-issue.schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/hrm/onboarding/equipment-acks — ack rows for one hire.
// POST /api/hrm/onboarding/equipment-acks — hiree digital-acknowledge of one
// ISSUED item. Writes into Todo 10's `acknowledgement_logs` store
// (doc_ref `equipment:ack:<profileId>:<itemKey>`, signer
// `hiree:<employeeId>` or `hr-override:<userId>`, method ink|stamp|typed).
// Ack-without-issue → 422 (never counted); double-ack collapses to 200.

function getPhilippineTime(): string {
  return new Date().toLocaleString("sv-SE", { timeZone: "Asia/Manila" });
}

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

function ackPrefix(profileId: number): string {
  return `equipment:ack:${profileId}:`;
}

async function findRows(docRef: string, signer?: string): Promise<AckLogRow[]> {
  const filters = [`filter[doc_ref][_eq]=${encodeURIComponent(docRef)}`];
  if (signer !== undefined) {
    filters.push(`filter[signer][_eq]=${encodeURIComponent(signer)}`);
  }
  const result = (await dFetch(
    `/items/acknowledgement_logs?${filters.join("&")}&limit=5`
  )) as { data?: AckLogRow[] };
  return Array.isArray(result?.data) ? (result.data as AckLogRow[]) : [];
}

export async function GET(req: NextRequest) {
  try {
    const params = Object.fromEntries(req.nextUrl.searchParams.entries());
    const query = EquipmentQuerySchema.safeParse(params);
    if (!query.success) {
      return validationFailed(query.error.flatten().fieldErrors);
    }
    const profileId = query.data.profile_id;
    const result = (await dFetch(
      `/items/acknowledgement_logs?filter[doc_ref][_contains]=${encodeURIComponent(ackPrefix(profileId))}&limit=100`
    )) as { data?: AckLogRow[] };
    return NextResponse.json({ success: true, data: result?.data ?? [] });
  } catch (error) {
    console.error("[onboarding-equipment-acks] list error:", error);
    return NextResponse.json(
      { success: false, message: "An unexpected error occurred. Please try again later." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body: unknown = await req.json().catch(() => null);
    const validation = AcknowledgeEquipmentItemSchema.safeParse(body);
    if (!validation.success) {
      return validationFailed(validation.error.flatten().fieldErrors);
    }
    const {
      profile_id: profileId,
      item_key: itemKey,
      signer,
      method,
    } = validation.data;

    let catalog;
    try {
      catalog = await loadServerEquipmentCatalog();
    } catch (error) {
      console.error("[onboarding-equipment-acks] catalog error:", error);
      return NextResponse.json(
        { success: false, message: "Equipment catalog is misconfigured" },
        { status: 500 }
      );
    }
    if (!findCatalogItem(catalog, itemKey)) {
      return NextResponse.json(
        { success: false, message: `Unknown equipment item: ${itemKey}` },
        { status: 400 }
      );
    }

    const issueRef = equipmentDocRef("issue", profileId, itemKey);
    const issueRows = await findRows(issueRef);
    if (issueRows.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Cannot acknowledge an item that was not issued",
        },
        { status: 422 }
      );
    }

    const ackRef = equipmentDocRef("ack", profileId, itemKey);
    const prior = await findRows(ackRef, signer);
    if (prior.length > 0) {
      return NextResponse.json({ success: true, data: prior[0] ?? null });
    }

    const now = getPhilippineTime();
    let created: { data?: AckLogRow };
    try {
      created = (await dFetch("/items/acknowledgement_logs", {
        method: "POST",
        body: JSON.stringify({
          doc_ref: ackRef,
          signer,
          acknowledged_at: now,
          method,
        }),
      })) as { data?: AckLogRow };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("RECORD_NOT_UNIQUE") || message.includes("doc_ref")) {
        const retry = await findRows(ackRef, signer);
        return NextResponse.json({
          success: true,
          data: retry[0] ?? null,
        });
      }
      throw error;
    }

    return NextResponse.json(
      { success: true, data: created?.data ?? null },
      { status: 201 }
    );
  } catch (error) {
    console.error("[onboarding-equipment-acks] create error:", error);
    return NextResponse.json(
      { success: false, message: "An unexpected error occurred. Please try again later." },
      { status: 500 }
    );
  }
}
