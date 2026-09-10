"use client";

import { useState } from "react";
import Link from "next/link";
import { ClipboardCheck, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

import { CompletionTab } from "@/modules/human-resource-management/onboarding/completion";
import { EquipmentTab } from "@/modules/human-resource-management/onboarding/equipment/components/EquipmentTab";
import { OrientationFetchProvider, OrientationTab } from "@/modules/human-resource-management/onboarding/orientation";
import {
  VerificationFetchProvider,
  VerificationTab,
} from "@/modules/human-resource-management/onboarding/verification";

import { useHireWorkspace } from "../hooks/useHireWorkspace";
import { phaseLabel, ROSTER_STATUS_LABELS, rosterStatusTone } from "../rosterData";
import type { WorkspaceOperator } from "../taskInbox";
import { TrainingTab } from "./TrainingTab";
import { WorkspaceOverview } from "./WorkspaceOverview";

// OnboardingWorkspace.tsx — the per-hire workspace (todo 28). One canonical
// employee from the route param (`userId`) drives every section; the in-page
// navigation is the six WORKFLOW sections (Overview/Documents/Orientation/
// Training/Equipment/Completion), never the applicant statuses, and there is
// no second hire selector anywhere inside. Each phase surface consumes the
// re-keyed module component through its `userId` seam.

const SECTIONS = [
  { value: "overview", label: "Overview" },
  { value: "documents", label: "Documents" },
  { value: "orientation", label: "Orientation" },
  { value: "training", label: "Training" },
  { value: "equipment", label: "Equipment" },
  { value: "completion", label: "Completion" },
] as const;

export function OnboardingWorkspace({
  userId,
  operatorRole,
  operatorUserId,
}: {
  userId: number;
  operatorRole: WorkspaceOperator["role"];
  operatorUserId: number | null;
}) {
  const { row, phaseGroups, loading, error, refresh } =
    useHireWorkspace(userId);
  const [active, setActive] = useState<string>("overview");
  const operator: WorkspaceOperator = {
    userId: operatorUserId,
    role: operatorRole,
  };

  const handleSectionChange = (value: string) => {
    setActive(value);
    void refresh();
  };

  const title = row?.name ?? `Employee #${userId}`;

  return (
    <div className="mx-auto min-h-screen max-w-[1600px] space-y-6 p-2 sm:p-6 md:p-10">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <div className="shrink-0 rounded-2xl bg-primary/10 p-3">
            <ClipboardCheck
              className="h-6 w-6 text-primary"
              aria-hidden="true"
            />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-2xl font-bold sm:text-4xl">
                {title}
              </h1>
              {row ? (
                <StatusBadge tone={rosterStatusTone(row.status)}>
                  {ROSTER_STATUS_LABELS[row.status]}
                </StatusBadge>
              ) : null}
            </div>
            <p className="text-base text-muted-foreground sm:text-lg">
              Employee #{userId} · {row ? phaseLabel(row.phase) : "Onboarding"} · workspace
            </p>
          </div>
        </div>

        <div className="flex shrink-0 gap-2">
          <Button
            asChild
            variant="outline"
            size="sm"
            className="w-full sm:w-auto"
          >
            <Link href={`/hrm/onboarding?selected=${userId}`}>Back to hub</Link>
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="w-full sm:w-auto"
            onClick={() => void refresh()}
            disabled={loading}
            aria-label="Refresh workspace"
            title="Refresh workspace"
          >
            <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
            Refresh
          </Button>
        </div>
      </div>

      <Tabs
        value={active}
        onValueChange={handleSectionChange}
        className="space-y-4"
      >
        <TabsList className="w-full justify-start overflow-x-auto overflow-y-hidden">
          {SECTIONS.map((section) => (
            <TabsTrigger
              key={section.value}
              value={section.value}
              className="shrink-0"
            >
              {section.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview" className="m-0">
          <WorkspaceOverview
            row={row}
            groups={phaseGroups}
            operator={operator}
            loading={loading}
            error={error}
            onRefresh={() => void refresh()}
          />
        </TabsContent>

        <TabsContent value="documents" className="m-0">
          <VerificationFetchProvider>
            <VerificationTab key={`documents-${userId}`} userId={userId} />
          </VerificationFetchProvider>
        </TabsContent>

        <TabsContent value="orientation" className="m-0">
          <OrientationFetchProvider>
            <OrientationTab key={`orientation-${userId}`} userId={userId} />
          </OrientationFetchProvider>
        </TabsContent>

        <TabsContent value="training" className="m-0">
          <TrainingTab key={`training-${userId}`} userId={userId} />
        </TabsContent>

        <TabsContent value="equipment" className="m-0">
          <EquipmentTab key={`equipment-${userId}`} userId={userId} />
        </TabsContent>

        <TabsContent value="completion" className="m-0">
          <CompletionTab key={`completion-${userId}`} userId={userId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
