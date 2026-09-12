"use client";

import { useRequirementsCatalogs } from "../hooks/useRequirementsCatalogs";
import { DocumentsSection } from "../sections/DocumentsSection";
import { EquipmentSection } from "../sections/EquipmentSection";
import { OrientationSection } from "../sections/OrientationSection";
import { TrainingSection } from "../sections/TrainingSection";

// RequirementsSections.tsx — composes the four catalog sections from the todo-15
// fetch provider. Each section owns its own loading/error/reorder lifecycle;
// this shell only distributes the catalog resources.

export function RequirementsSections() {
  const { documents, orientation, taskTemplates, equipment } =
    useRequirementsCatalogs();

  return (
    <div className="space-y-10">
      <DocumentsSection resource={documents} />
      <OrientationSection resource={orientation} />
      <TrainingSection resource={taskTemplates} />
      <EquipmentSection resource={equipment} />
    </div>
  );
}
