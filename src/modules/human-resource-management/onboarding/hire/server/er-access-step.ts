import { dFetch } from "@/modules/human-resource-management/shared/utils/directus";

import type {
  HireCompletionStep,
  HireCompletionStepResult,
} from "../types/hire.schema";

// er-access-step.ts — default Employee Relations access for every new hire.
//
// Runs AFTER the orchestrator resolved/created the employee: grants the ER
// subsystem row plus one `user_access_modules` row per module currently
// registered under it, so the hire lands with working ER access and no manual
// User Configuration pass is required. Both writes are needed — the
// middleware denies any REGISTERED module path the user does not hold a
// `user_access_modules` row for (parent coverage does not flow down), while
// the subsystem row keeps the registry and the JWT claim consistent.
// Registry-driven, never hard-coded ids: subsystem `er` and its modules are
// read live, so future ER modules are picked up automatically. Read-first and
// idempotent per the seam contract: only rows the user does not already hold
// are inserted, and any failure returns ok:false so the hire itself still
// succeeds. `userId` IS the correlation to the employee (no DB column added).

const STEP_NAME = "er-access";
const ER_SUBSYSTEM_SLUG = "er";

interface AccessListRow {
  id?: number;
  subsystem_id?: number;
  module_id?: number;
}

async function getListRows(url: string): Promise<AccessListRow[]> {
  const body = (await dFetch(url)) as { data?: unknown; errors?: unknown };
  if (body?.errors) {
    throw new Error(JSON.stringify(body.errors).slice(0, 300));
  }
  return Array.isArray(body?.data) ? (body.data as AccessListRow[]) : [];
}

async function postRow(url: string, payload: unknown): Promise<void> {
  const body = (await dFetch(url, {
    method: "POST",
    body: JSON.stringify(payload),
  })) as { data?: unknown; errors?: unknown };
  if (body?.errors) {
    throw new Error(JSON.stringify(body.errors).slice(0, 300));
  }
}

function toIdList(rows: AccessListRow[], key: "id" | "subsystem_id" | "module_id"): number[] {
  return rows
    .map((row) => row[key])
    .filter((id): id is number => typeof id === "number" && Number.isInteger(id));
}

export const erAccessStep: HireCompletionStep = async (
  context
): Promise<HireCompletionStepResult> => {
  try {
    const userId = context.userId;

    const subsystems = await getListRows(
      `/items/subsystems?filter[slug][_eq]=${ER_SUBSYSTEM_SLUG}&fields=id&limit=1`
    );
    const subsystemId = toIdList(subsystems, "id")[0];
    if (subsystemId === undefined) {
      throw new Error(
        `subsystem '${ER_SUBSYSTEM_SLUG}' not found in the registry`
      );
    }

    const modules = await getListRows(
      `/items/modules?filter[subsystem_id][_eq]=${subsystemId}&fields=id&limit=-1`
    );
    const moduleIds = toIdList(modules, "id");

    const [heldSubsystems, heldModules] = await Promise.all([
      getListRows(
        `/items/user_access_subsystems?filter[user_id][_eq]=${userId}&fields=subsystem_id&limit=-1`
      ),
      getListRows(
        `/items/user_access_modules?filter[user_id][_eq]=${userId}&fields=module_id&limit=-1`
      ),
    ]);
    const heldSubsystemIds = new Set(toIdList(heldSubsystems, "subsystem_id"));
    const heldModuleIds = new Set(toIdList(heldModules, "module_id"));

    let subsystemAdded = 0;
    if (!heldSubsystemIds.has(subsystemId)) {
      await postRow("/items/user_access_subsystems", {
        user_id: userId,
        subsystem_id: subsystemId,
      });
      subsystemAdded = 1;
    }

    const missingModules = moduleIds.filter((id) => !heldModuleIds.has(id));
    if (missingModules.length > 0) {
      await postRow(
        "/items/user_access_modules",
        missingModules.map((module_id) => ({ user_id: userId, module_id }))
      );
    }

    return {
      step: STEP_NAME,
      ok: true,
      detail: `user_id=${userId} subsystem added=${subsystemAdded} modules added=${missingModules.length} total=${moduleIds.length}`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { step: STEP_NAME, ok: false, detail: message };
  }
};
