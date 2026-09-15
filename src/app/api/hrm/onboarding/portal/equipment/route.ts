import { NextRequest, NextResponse } from "next/server";

import { dFetch } from "@/modules/human-resource-management/shared/utils/directus";
import {
  readPortalToken,
  resolvePortalIdentity,
} from "@/modules/human-resource-management/employee-portal";
import {
  AcknowledgePortalEquipmentSchema,
  type PortalEquipmentItem,
} from "@/modules/human-resource-management/employee-portal/types/portal-equipment.schema";
import { loadEquipmentCatalog } from "@/modules/human-resource-management/onboarding/equipment/server/equipmentItemIo";
import { findCatalogItem } from "@/modules/human-resource-management/onboarding/equipment/equipmentCatalog";
import {
  equipmentDocRef,
  hireeSigner,
  parseEquipmentDocRef,
} from "@/modules/human-resource-management/onboarding/equipment/equipmentPredicate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET/POST /api/hrm/onboarding/portal/equipment — the hiree's OWN equipment
// handover log, scoped to the session-resolved post-hire employee. The ack
// signer is FORCED to `hiree:<resolved user_id>` and no client-supplied
// user_id/signer is ever read. Pre-hire (no employee record) lists nothing
// and cannot acknowledge. Method is not part of the log contract.

function getPhilippineTime(): string {
  return new Date().toLocaleString("sv-SE", { timeZone: "Asia/Manila" });
}

interface AckLogRow {
  id?: number;
  doc_ref?: string;
  signer?: string;
  acknowledged_at?: string;
}

function ackPrefix(userId: number): string {
  return `equipment:ack:${userId}:`;
}

function issuePrefix(userId: number): string {
  return `equipment:issue:${userId}:`;
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
    const resolved = await resolvePortalIdentity(readPortalToken(req));
    if (!resolved.ok) {
      return NextResponse.json(
        { success: false, message: resolved.message },
        { status: resolved.status }
      );
    }
    if (
      resolved.identity.kind !== "employee" ||
      resolved.identity.user_id === null
    ) {
      return NextResponse.json({ success: true, data: [] });
    }
    const userId = resolved.identity.user_id;

    let catalog;
    try {
      catalog = await loadEquipmentCatalog();
    } catch (error) {
      console.error("[onboarding-portal-equipment] catalog error:", error);
      return NextResponse.json(
        { success: false, message: "Could not load the equipment catalog" },
        { status: 500 }
      );
    }

    const [issues, acks] = await Promise.all([
      dFetch(
        `/items/acknowledgement_logs?filter[doc_ref][_contains]=${encodeURIComponent(issuePrefix(userId))}&limit=100`
      ) as Promise<{ data?: AckLogRow[] }>,
      dFetch(
        `/items/acknowledgement_logs?filter[doc_ref][_contains]=${encodeURIComponent(ackPrefix(userId))}&limit=100`
      ) as Promise<{ data?: AckLogRow[] }>,
    ]);
    const issueRows = Array.isArray(issues?.data) ? issues.data : [];
    const ackRows = Array.isArray(acks?.data) ? acks.data : [];

    const issuedByItem = new Map<string, AckLogRow>();
    for (const row of issueRows) {
      const parsed = parseEquipmentDocRef(row.doc_ref);
      if (!parsed || parsed.kind !== "issue" || parsed.userId !== userId) continue;
      issuedByItem.set(parsed.itemKey, row);
    }
    const ackedByItem = new Map<string, AckLogRow>();
    for (const row of ackRows) {
      const parsed = parseEquipmentDocRef(row.doc_ref);
      if (!parsed || parsed.kind !== "ack" || parsed.userId !== userId) continue;
      const previous = ackedByItem.get(parsed.itemKey);
      if (
        !previous ||
        (row.acknowledged_at ?? "") >= (previous.acknowledged_at ?? "")
      ) {
        ackedByItem.set(parsed.itemKey, row);
      }
    }

    const items: PortalEquipmentItem[] = catalog.map((entry) => {
      const issue = issuedByItem.get(entry.key);
      const ack = ackedByItem.get(entry.key);
      return {
        key: entry.key,
        label: entry.label,
        issuer: entry.issuer,
        required: entry.required,
        issued: issue !== undefined,
        acked: issue !== undefined && ack !== undefined,
        issuedAt: issue?.acknowledged_at ?? null,
        ackedAt: ack?.acknowledged_at ?? null,
      };
    });

    return NextResponse.json({ success: true, data: items });
  } catch (error) {
    console.error("[onboarding-portal-equipment] list error:", error);
    return NextResponse.json(
      {
        success: false,
        message: "An unexpected error occurred. Please try again later.",
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const resolved = await resolvePortalIdentity(readPortalToken(req));
    if (!resolved.ok) {
      return NextResponse.json(
        { success: false, message: resolved.message },
        { status: resolved.status }
      );
    }
    if (
      resolved.identity.kind !== "employee" ||
      resolved.identity.user_id === null
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "A post-hire employee record is required for equipment",
        },
        { status: 404 }
      );
    }
    const userId = resolved.identity.user_id;

    const body: unknown = await req.json().catch(() => null);
    const validation = AcknowledgePortalEquipmentSchema.safeParse(body);
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
    const itemKey = validation.data.item_key;

    let catalog;
    try {
      catalog = await loadEquipmentCatalog();
    } catch (error) {
      console.error("[onboarding-portal-equipment] catalog error:", error);
      return NextResponse.json(
        { success: false, message: "Could not load the equipment catalog" },
        { status: 500 }
      );
    }
    if (!findCatalogItem(catalog, itemKey)) {
      return NextResponse.json(
        { success: false, message: `Unknown equipment item: ${itemKey}` },
        { status: 400 }
      );
    }

    const issueRef = equipmentDocRef("issue", userId, itemKey);
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

    const signer = hireeSigner(userId);
    const ackRef = equipmentDocRef("ack", userId, itemKey);
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
        }),
      })) as { data?: AckLogRow };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("RECORD_NOT_UNIQUE") || message.includes("doc_ref")) {
        const retry = await findRows(ackRef, signer);
        return NextResponse.json({ success: true, data: retry[0] ?? null });
      }
      throw error;
    }

    return NextResponse.json(
      { success: true, data: created?.data ?? null },
      { status: 201 }
    );
  } catch (error) {
    console.error("[onboarding-portal-equipment] create error:", error);
    return NextResponse.json(
      {
        success: false,
        message: "An unexpected error occurred. Please try again later.",
      },
      { status: 500 }
    );
  }
}
