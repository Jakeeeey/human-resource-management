"use client";

// OnboardingHubModule.tsx — HR hub root. Todo 27 replaced the flat tab
// navigation (Verification/Orientation/Training/Equipment/Completion) with a
// filterable master-detail roster: the hub ENTRY is now the enriched hire
// list, and the per-phase surfaces move into the per-hire workspace (todo 28+).
// No stage/status is a tab.

import { ClipboardCheck, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";

import { HireRoster } from "./components/HireRoster";
import { HIRE_ROSTER_REFRESH_EVENT } from "./hooks/useHireRoster";

export function OnboardingHubModule() {
  return (
    <div className="p-2 sm:p-6 md:p-10 max-w-[1600px] mx-auto min-h-screen space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-primary/10 rounded-2xl shrink-0">
            <ClipboardCheck className="h-6 w-6 text-primary" />
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-4xl font-bold truncate">
              Onboarding Hub
            </h1>
            <p className="text-base sm:text-lg text-muted-foreground">
              Every hire, their phase, next action, owner, due date, and
              blockers.
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="w-full shrink-0 sm:w-auto"
          onClick={() => window.dispatchEvent(new Event(HIRE_ROSTER_REFRESH_EVENT))}
          aria-label="Refresh roster"
          title="Refresh roster"
        >
          <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
          Refresh
        </Button>
      </div>

      <HireRoster />
    </div>
  );
}
