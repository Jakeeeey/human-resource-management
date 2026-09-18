import { NextRequest, NextResponse } from "next/server";

import {
  readPortalToken,
  resolvePortalIdentity,
} from "@/modules/human-resource-management/employee-portal";
import type { PortalTrainingItem } from "@/modules/human-resource-management/employee-portal/types/portal-training.schema";
import { listOnboardingTasks } from "@/modules/human-resource-management/onboarding/tasks/server/onboarding-task-service";
import { listOnboardingTaskTemplates } from "@/modules/human-resource-management/onboarding/tasks/server/task-template-service";
import type {
  OnboardingTask,
  OnboardingTaskTemplate,
} from "@/modules/human-resource-management/onboarding/types/onboarding-task.schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TRAINING_PHASE = "training";

interface OrderedTrainingItem {
  sortOrder: number;
  item: PortalTrainingItem;
}

function buildTrainingItems(
  tasks: readonly OnboardingTask[],
  templates: readonly OnboardingTaskTemplate[]
): PortalTrainingItem[] {
  const templateById = new Map(
    templates.map((template) => [template.id, template])
  );
  const ordered: OrderedTrainingItem[] = [];
  for (const task of tasks) {
    if (task.template_id === null) continue;
    const template = templateById.get(task.template_id);
    if (!template || template.is_active !== true) continue;
    if (template.phase !== TRAINING_PHASE) continue;
    ordered.push({
      sortOrder: template.sort_order,
      item: {
        id: task.id,
        title: template.title,
        status: task.status,
        dueDate: task.due_date,
      },
    });
  }
  ordered.sort((a, b) => a.sortOrder - b.sortOrder || a.item.id - b.item.id);
  return ordered.map((entry) => entry.item);
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
    const tasks = await listOnboardingTasks({ userId });
    const templates = await listOnboardingTaskTemplates();

    return NextResponse.json({
      success: true,
      data: buildTrainingItems(tasks, templates),
    });
  } catch (error) {
    console.error("[onboarding-portal] training error:", error);
    return NextResponse.json(
      {
        success: false,
        message: "An unexpected error occurred. Please try again later.",
      },
      { status: 500 }
    );
  }
}
