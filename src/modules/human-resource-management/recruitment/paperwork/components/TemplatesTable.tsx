"use client";

import { Frame, Pencil } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import type { TemplateTableControls } from "../hooks/useTemplateTableControls";
import type { PaperworkTemplate } from "../types/paperwork-template.schema";
import { TemplatesTablePagination } from "./TemplatesTablePagination";

// TemplatesTable.tsx — registry rows: companies (junction set, "—" when
// unscoped), title (truncated per QA §1), active flag, edit + zones actions.
// Adopts the requirements catalog card design (scroll-fade, sr-only caption,
// plain column headers, always-rendered pagination) so both list surfaces share
// one design language. PDF-only: every template is an uploaded PDF (no source
// column).

interface TemplatesTableProps {
  /** Search/status/sort/page state owned by the tab. */
  controls: TemplateTableControls;
  isLoading: boolean;
  templateCompanyIds: Map<number, number[]>;
  companyById: Map<number, { name: string; code: string }>;
  onEdit: (template: PaperworkTemplate) => void;
  onZones: (template: PaperworkTemplate) => void;
}

export function TemplatesTable({
  controls,
  isLoading,
  templateCompanyIds,
  companyById,
  onEdit,
  onZones,
}: TemplatesTableProps) {
  if (isLoading) {
    return (
      <div className="relative overflow-hidden rounded-2xl border border-border/50 bg-card p-3 shadow-sm">
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>
    );
  }

  if (controls.totalCount === 0 && !controls.isFiltered) {
    return (
      <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
        No paperwork templates yet. Upload the first PDF to start marking signature zones.
      </p>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border/50 bg-card shadow-sm">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 right-0 z-10 w-8 bg-gradient-to-l from-card to-transparent sm:hidden"
      />
      <Table className="min-w-[720px]">
        <TableCaption className="sr-only">Paperwork templates</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead
              scope="col"
              className="max-w-[360px]"
              title="Template title"
            >
              Title
            </TableHead>
            <TableHead
              scope="col"
              className="max-w-[200px]"
              title="Companies this template is scoped to"
            >
              Company(s)
            </TableHead>
            <TableHead
              scope="col"
              className="w-24"
              title="Whether this template is currently in use"
            >
              Status
            </TableHead>
            <TableHead scope="col" className="w-[190px] text-right">
              Actions
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {controls.visibleRows.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={4}
                className="py-8 text-center text-sm text-muted-foreground"
              >
                No rows match your current search and filters.
              </TableCell>
            </TableRow>
          ) : (
            controls.visibleRows.map((template) => {
              const junctionIds = templateCompanyIds.get(template.id) ?? [];
              const junctionNames = junctionIds.map(
                (id) => companyById.get(id)?.name ?? `#${id}`
              );
              const companyTitle =
                junctionNames.length > 0 ? junctionNames.join(", ") : "—";
              return (
                <TableRow key={template.id}>
                  <TableCell
                    className="max-w-[360px] truncate"
                    title={template.title}
                  >
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
                    <Badge
                      variant={template.is_active ? "default" : "secondary"}
                    >
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
                        aria-label={`Edit template ${template.title}`}
                      >
                        <Pencil className="mr-1 h-4 w-4" aria-hidden="true" />
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onZones(template)}
                        className="min-h-8"
                        aria-label={`Zones template ${template.title}`}
                      >
                        <Frame className="mr-1 h-4 w-4" aria-hidden="true" />
                        Zones
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>

      <TemplatesTablePagination
        page={controls.page}
        pageSize={controls.pageSize}
        totalPages={controls.totalPages}
        filteredCount={controls.filteredCount}
        rangeStart={controls.rangeStart}
        rangeEnd={controls.rangeEnd}
        onPageChange={controls.setPage}
        onPageSizeChange={controls.setPageSize}
      />
    </div>
  );
}
