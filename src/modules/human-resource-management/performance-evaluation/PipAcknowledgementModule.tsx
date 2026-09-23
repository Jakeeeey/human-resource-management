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

  return (
    <div className="flex-1 space-y-6 overflow-auto p-6 pt-8">
      <div className="flex flex-col gap-1.5 md:flex-row md:items-center md:justify-between md:gap-0">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl border bg-primary/10 text-primary shadow-sm">
            <ClipboardList className="h-6 w-6" aria-hidden="true" />
          </div>
          <div className="space-y-1">
            <h2 className="text-3xl font-black leading-tight tracking-tighter text-foreground">
              My Performance Improvement Plans
            </h2>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground opacity-60">
              Review and acknowledge your Performance Improvement Plans.
            </p>
          </div>
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
