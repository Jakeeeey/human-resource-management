"use client";

import { useState } from "react";
import type { JSX } from "react";
import { ArrowLeft, ClipboardList } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useMyPips } from "./hooks/usePipAcknowledgement";
import { MyPipList } from "./components/MyPipList";
import { PipAcknowledgeView } from "./components/PipAcknowledgeView";

export function PipAcknowledgementModule(): JSX.Element {
  const { pips, loading, error, refresh } = useMyPips();
  const [selectedPipId, setSelectedPipId] = useState<number | null>(null);
  const pendingCount = pips.filter((pip) => pip.employee_acknowledged_at === null).length;

  return (
    <div className="flex-1 space-y-6 overflow-auto bg-background p-4 sm:p-6">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius)] border bg-card text-primary shadow-sm">
          <ClipboardList className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h2 className="truncate text-xl font-semibold tracking-tight md:text-2xl">
            My Performance Improvement Plans
          </h2>
          <p className="text-xs text-muted-foreground tabular-nums">
            {loading
              ? "Loading your plans…"
              : error
                ? "Could not load your plans."
                : pips.length === 0
                  ? "Nothing assigned to you right now."
                  : pendingCount > 0
                    ? `${pendingCount} of ${pips.length} awaiting acknowledgement`
                    : `All ${pips.length} acknowledged.`}
          </p>
        </div>
      </div>

      {selectedPipId === null ? (
        <MyPipList
          pips={pips}
          loading={loading}
          error={error}
          selectedPipId={selectedPipId}
          onSelect={setSelectedPipId}
          onRetry={() => void refresh()}
        />
      ) : (
        <div className="space-y-4">
          <Button variant="outline" size="sm" onClick={() => setSelectedPipId(null)}>
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            Back to my PIPs
          </Button>
          <PipAcknowledgeView key={selectedPipId} pipId={selectedPipId} />
        </div>
      )}
    </div>
  );
}
