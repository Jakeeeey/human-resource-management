"use client";

import { useCallback, useSyncExternalStore } from "react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { useRequirementsCatalogs } from "../hooks/useRequirementsCatalogs";
import { DocumentsSection } from "../sections/DocumentsSection";
import { EquipmentSection } from "../sections/EquipmentSection";
import { OrientationSection } from "../sections/OrientationSection";
import { TrainingSection } from "../sections/TrainingSection";

// RequirementsSections.tsx — composes the four catalog sections from the todo-15
// fetch provider into one tab per catalog (Documents / Orientation / Training /
// Equipment). Each section owns its own loading/error/reorder lifecycle; this
// shell only distributes the catalog resources and keeps the active tab in the
// URL hash so a reload (or a shared link) restores the same view.

const TAB_IDS = ["documents", "orientation", "training", "equipment"] as const;
type TabId = (typeof TAB_IDS)[number];
const DEFAULT_TAB: TabId = "documents";

function readHashTab(): TabId {
  const hash = window.location.hash.replace(/^#/, "");
  return (TAB_IDS as readonly string[]).includes(hash)
    ? (hash as TabId)
    : DEFAULT_TAB;
}

function getServerTab(): TabId {
  return DEFAULT_TAB;
}

function subscribeHash(onChange: () => void): () => void {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}

export function RequirementsSections() {
  const { documents, orientation, taskTemplates, equipment } =
    useRequirementsCatalogs();
  const active = useSyncExternalStore(subscribeHash, readHashTab, getServerTab);

  const handleTabChange = useCallback((value: string) => {
    if (!(TAB_IDS as readonly string[]).includes(value)) return;
    const nextHash = `#${value}`;
    if (window.location.hash === nextHash) return;
    window.history.replaceState(null, "", nextHash);
    window.dispatchEvent(new Event("hashchange"));
  }, []);

  const tabs: readonly { id: TabId; label: string; count: number }[] = [
    { id: "documents", label: "Documents", count: documents.rows.length },
    { id: "orientation", label: "Orientation", count: orientation.rows.length },
    {
      id: "training",
      label: "Training",
      count: taskTemplates.rows.filter((row) => row.phase === "training").length,
    },
    { id: "equipment", label: "Equipment", count: equipment.rows.length },
  ];

  return (
    <Tabs value={active} onValueChange={handleTabChange} className="space-y-6">
      <TabsList className="group-data-[orientation=horizontal]/tabs:h-auto w-full flex-wrap justify-start gap-1">
        {tabs.map((tab) => (
          <TabsTrigger key={tab.id} value={tab.id} className="shrink-0">
            {tab.label}{" "}
            <span className="text-muted-foreground">({tab.count})</span>
          </TabsTrigger>
        ))}
      </TabsList>

      <TabsContent value="documents" className="m-0">
        <DocumentsSection resource={documents} />
      </TabsContent>
      <TabsContent value="orientation" className="m-0">
        <OrientationSection resource={orientation} />
      </TabsContent>
      <TabsContent value="training" className="m-0">
        <TrainingSection resource={taskTemplates} />
      </TabsContent>
      <TabsContent value="equipment" className="m-0">
        <EquipmentSection resource={equipment} />
      </TabsContent>
    </Tabs>
  );
}
