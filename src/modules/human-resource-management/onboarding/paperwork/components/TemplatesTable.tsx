"use client";

import type { PaperworkTemplate } from "../types/paperwork-template.schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Frame, Pencil } from "lucide-react";

// TemplatesTable.tsx — registry rows: companies (junction set, "—" when
// unscopped), title (truncated per QA §1), zone counts (required/total),
// active flag, edit + zones actions.
// PDF-only: every template is an uploaded PDF (no source column).

interface TemplatesTableProps {
  templates: PaperworkTemplate[];
  isLoading: boolean;
  templateCompanyIds: Map<number, number[]>;
  companyById: Map<number, { name: string; code: string }>;
  onEdit: (template: PaperworkTemplate) => void;
  onZones: (template: PaperworkTemplate) => void;
}

export function TemplatesTable({
  templates,
  isLoading,
  templateCompanyIds,
  companyById,
  onEdit,
  onZones,
}: TemplatesTableProps) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  if (templates.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
        No paperwork templates yet. Upload the first PDF to start marking signature zones.
      </p>
    );
  }

  return (
    <div className="bg-card border border-border/50 rounded-2xl overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
      <Table className="min-w-[720px]">
        <TableHeader>
          <TableRow>
            <TableHead className="max-w-[360px]">Title</TableHead>
            <TableHead className="max-w-[200px]">Company(s)</TableHead>
            <TableHead className="w-24">Status</TableHead>
            <TableHead className="w-[190px] text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {templates.map((template) => {
            const junctionIds = templateCompanyIds.get(template.id) ?? [];
            const junctionNames = junctionIds.map(
              (id) => companyById.get(id)?.name ?? `#${id}`
            );
            const companyTitle =
              junctionNames.length > 0 ? junctionNames.join(", ") : "—";
            return (
              <TableRow key={template.id}>
                <TableCell className="max-w-[360px] truncate" title={template.title}>
                  {template.title}
                </TableCell>
                <TableCell
                  className="max-w-[200px]"
                  title={companyTitle}
                >
                  {junctionNames.length > 0 ? (
                    <span className="flex min-w-0 flex-wrap gap-1">
                      {junctionNames.slice(0, 2).map((name) => (
                        <Badge
                          key={name}
                          variant="outline"
                          className="block max-w-full truncate text-left font-normal"
                          title={name}
                        >
                          {name}
                        </Badge>
                      ))}
                      {junctionNames.length > 2 && (
                        <Badge variant="secondary">
                          +{junctionNames.length - 2}
                        </Badge>
                      )}
                    </span>
                  ) : (
                    <span className="block truncate text-xs text-muted-foreground">
                      —
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant={template.is_active ? "default" : "secondary"}>
                    {template.is_active ? "active" : "inactive"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onEdit(template)}
                      className="min-h-8"
                    >
                      <Pencil className="mr-1 h-4 w-4" />
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onZones(template)}
                      className="min-h-8"
                    >
                      <Frame className="mr-1 h-4 w-4" />
                      Zones
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      </div>
    </div>
  );
}
