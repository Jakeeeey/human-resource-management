"use client";

import { useCallback, useSyncExternalStore } from "react";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { useRequirementsCatalogs } from "../hooks/useRequirementsCatalogs";
import { DocumentsSection } from "../sections/DocumentsSection";
import { EquipmentSection } from "../sections/EquipmentSection";
import { OrientationSection } from "../sections/OrientationSection";

// RequirementsSections.tsx — composes the three catalog sections from the todo-15
// fetch provider. Only the active catalog section renders; it receives the
// Documents / Orientation / Equipment tab strip and places it between its own
// filter bar and its table. Each section owns its own loading/error/reorder
// lifecycle; this shell only distributes the catalog resources and keeps the
// active tab in the URL hash so a reload (or a shared link) restores the view.

const TAB_IDS = ["documents", "orientation", "equipment"] as const;
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
  const { documents, orientation, equipment } = useRequirementsCatalogs();
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
    { id: "equipment", label: "Equipment", count: equipment.rows.length },
  ];

  const tabsList = (
    <TabsList className="justify-start">
      {tabs.map((tab) => (
        <TabsTrigger key={tab.id} value={tab.id} className="shrink-0">
          {tab.label}{" "}
          <span className="text-muted-foreground">({tab.count})</span>
        </TabsTrigger>
      ))}
    </TabsList>
  );

  return (
    <Tabs value={active} onValueChange={handleTabChange} className="space-y-6">
      {active === "documents" && (
        <DocumentsSection resource={documents} tabsSlot={tabsList} />
      )}
      {active === "orientation" && (
        <OrientationSection resource={orientation} tabsSlot={tabsList} />
      )}
      {active === "equipment" && (
        <EquipmentSection resource={equipment} tabsSlot={tabsList} />
      )}
    </Tabs>
  );
}
