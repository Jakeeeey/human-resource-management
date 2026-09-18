import { NextRequest, NextResponse } from "next/server";

import { dFetch } from "@/modules/human-resource-management/shared/utils/directus";
import { loadEquipmentCatalog } from "@/modules/human-resource-management/onboarding/equipment/server/equipmentItemIo";
import { findCatalogItem } from "@/modules/human-resource-management/onboarding/equipment/equipmentCatalog";
import {
  buildEquipmentItemStates,
  equipmentDocRef,
  issuerSigner,
} from "@/modules/human-resource-management/onboarding/equipment/equipmentPredicate";
import { IssueEquipmentItemSchema } from "@/modules/human-resource-management/onboarding/equipment/types/equipment-issue.schema";
import { EquipmentQuerySchema } from "@/modules/human-resource-management/onboarding/equipment/types/equipment-issue.schema";
import { readUserExists } from "@/modules/human-resource-management/onboarding/tasks/server/onboardingTaskIo";
import {
  completeOnboardingTask,
  listOnboardingTasks,
} from "@/modules/human-resource-management/onboarding/tasks/server/onboarding-task-service";
import { listOnboardingTaskTemplates } from "@/modules/human-resource-management/onboarding/tasks/server/task-template-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/hrm/onboarding/equipment-issues?user_id= — issue rows for one
// EMPLOYEE (`user.user_id`).
// POST /api/hrm/onboarding/equipment-issues — HR records handover of one
// catalog item. Writes an issue row into `acknowledgement_logs`
// (doc_ref `equipment:issue:<userId>:<itemKey>`, signer `issuer:<role>`; no
// method column). Unknown employees → 400; unknown item keys → 400;
// double-issue → 409. Asset tables are NEVER written here (Master List owns
// assets).

function getPhilippineTime(): string {
  return new Date().toLocaleString("sv-SE", { timeZone: "Asia/Manila" });
}

function validationFailed(errors: Record<string, string[]>) {
  return NextResponse.json(
    { success: false, message: "Validation failed", errors },
    { status: 400 }
  );
}

function employeeNotFound() {
  return NextResponse.json(
    { success: false, message: "The employee does not exist" },
    { status: 400 }
  );
}

interface AckLogRow {
  id?: number;
  doc_ref?: string;
  signer?: string;
  acknowledged_at?: string;
}

function issuePrefix(userId: number): string {
  return `equipment:issue:${userId}:`;
}

async function syncEquipmentIssuedTask(userId: number): Promise<void> {
  try {
    const [catalog, templates, tasks] = await Promise.all([
      loadEquipmentCatalog(),
      listOnboardingTaskTemplates(),
      listOnboardingTasks({ userId }),
    ]);
    const template =
      templates.find(
        (t) =>
          t.phase === "equipment" &&
          t.code === "equipment_issued" &&
          t.is_active === true
      ) ?? null;
    if (!template) return;
    const task = tasks.find((t) => t.template_id === template.id) ?? null;
    if (!task || task.status === "done") return;
    const body = (await dFetch(
      `/items/acknowledgement_logs?filter[doc_ref][_contains]=${encodeURIComponent(issuePrefix(userId))}&fields=doc_ref&limit=100`
    )) as { data?: AckLogRow[] };
    const docRefs = Array.isArray(body?.data)
      ? body.data.map((row) => row.doc_ref)
      : [];
    const states = buildEquipmentItemStates(
      userId,
      catalog.map((entry) => ({ key: entry.key, required: entry.required })),
      docRefs
    );
    const required = states.filter((s) => s.required);
    if (required.length > 0 && required.every((s) => s.issued)) {
      await completeOnboardingTask({ taskId: task.id, completedBy: null });
    }
  } catch (error) {
    console.error(
      "[onboarding-equipment-issues] issued-task sync failed:",
      error
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const params = Object.fromEntries(req.nextUrl.searchParams.entries());
    const query = EquipmentQuerySchema.safeParse(params);
    if (!query.success) {
      return validationFailed(query.error.flatten().fieldErrors);
    }
    const userId = query.data.user_id;
    const result = (await dFetch(
      `/items/acknowledgement_logs?filter[doc_ref][_contains]=${encodeURIComponent(issuePrefix(userId))}&limit=100`
    )) as { data?: AckLogRow[] };
    return NextResponse.json({ success: true, data: result?.data ?? [] });
  } catch (error) {
    console.error("[onboarding-equipment-issues] list error:", error);
    return NextResponse.json(
      { success: false, message: "An unexpected error occurred. Please try again later." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body: unknown = await req.json().catch(() => null);
    const validation = IssueEquipmentItemSchema.safeParse(body);
    if (!validation.success) {
      return validationFailed(validation.error.flatten().fieldErrors);
    }
    const { user_id: userId, item_key: itemKey } = validation.data;

    if (!(await readUserExists(userId))) {
      return employeeNotFound();
    }

    let catalog;
    try {
      catalog = await loadEquipmentCatalog();
    } catch (error) {
      console.error("[onboarding-equipment-issues] catalog error:", error);
      return NextResponse.json(
        { success: false, message: "Could not load the equipment catalog" },
        { status: 500 }
      );
    }
    const item = findCatalogItem(catalog, itemKey);
    if (!item) {
      return NextResponse.json(
        { success: false, message: `Unknown equipment item: ${itemKey}` },
        { status: 400 }
      );
    }

    const docRef = equipmentDocRef("issue", userId, itemKey);
    const existing = (await dFetch(
      `/items/acknowledgement_logs?filter[doc_ref][_eq]=${encodeURIComponent(docRef)}&fields=id&limit=1`
    )) as { data?: unknown[] };
    if (Array.isArray(existing?.data) && existing.data.length > 0) {
      return NextResponse.json(
        { success: false, message: "This item was already issued" },
        { status: 409 }
      );
    }

    const now = getPhilippineTime();
    let created: { data?: AckLogRow };
    try {
      created = (await dFetch("/items/acknowledgement_logs", {
        method: "POST",
        body: JSON.stringify({
          doc_ref: docRef,
          signer: issuerSigner(item.issuer),
          acknowledged_at: now,
        }),
      })) as { data?: AckLogRow };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("RECORD_NOT_UNIQUE") || message.includes("doc_ref")) {
        return NextResponse.json(
          { success: false, message: "This item was already issued" },
          { status: 409 }
        );
      }
      throw error;
    }

    await syncEquipmentIssuedTask(userId);

    return NextResponse.json(
      { success: true, data: created?.data ?? null },
      { status: 201 }
    );
  } catch (error) {
    console.error("[onboarding-equipment-issues] create error:", error);
    return NextResponse.json(
      { success: false, message: "An unexpected error occurred. Please try again later." },
      { status: 500 }
    );
  }
}
