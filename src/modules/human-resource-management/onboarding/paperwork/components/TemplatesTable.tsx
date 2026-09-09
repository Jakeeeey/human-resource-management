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

// TemplatesTable.tsx — registry rows: per-company key, title (truncated per
// QA §1), zone counts (required/total), active flag, edit + zones actions.

interface TemplatesTableProps {
  templates: PaperworkTemplate[];
  isLoading: boolean;
  onEdit: (template: PaperworkTemplate) => void;
  onZones: (template: PaperworkTemplate) => void;
}

export function TemplatesTable({
  templates,
  isLoading,
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
        No paperwork templates yet. Create the first Quill-built template to
        start marking signature zones.
      </p>
    );
  }

  return (
    <div className="bg-card border border-border/50 rounded-2xl overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
      <Table className="min-w-[720px]">
        <TableHeader>
          <TableRow>
            <TableHead>Company</TableHead>
            <TableHead>Title</TableHead>
            <TableHead>Zones</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {templates.map((template) => {
            const required = template.zones.filter((z) => z.required).length;
            return (
              <TableRow key={template.id}>
                <TableCell className="max-w-[140px] truncate font-mono text-xs" title={template.company_key}>
                  {template.company_key}
                </TableCell>
                <TableCell className="max-w-[280px] truncate" title={template.title}>
                  {template.title}
                </TableCell>
                <TableCell>
                  <Badge variant="outline">
                    {required} req / {template.zones.length} total
                  </Badge>
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
