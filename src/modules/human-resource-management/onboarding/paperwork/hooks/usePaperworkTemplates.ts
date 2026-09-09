"use client";

// usePaperworkTemplates.ts — selection + dialog + zones-editor intents over
// the paperwork template fetch provider. Template saves and zone publishes
// both funnel through the provider so the registry list stays the single
// source of truth.

import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import type {
  CreatePaperworkTemplateInput,
  PaperworkTemplate,
  PaperworkZone,
  UpdatePaperworkTemplateInput,
} from "../types/paperwork-template.schema";
import { usePaperworkTemplateFetch } from "../providers/paperworkTemplateProvider";

export function usePaperworkTemplates() {
  const {
    templates,
    isLoading,
    isError,
    error,
    refetch,
    createTemplate,
    updateTemplate,
  } = usePaperworkTemplateFetch();

  const [selected, setSelected] = useState<PaperworkTemplate | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [zonesOpen, setZonesOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const openCreate = useCallback(() => {
    setSelected(null);
    setDialogOpen(true);
  }, []);

  const openEdit = useCallback((template: PaperworkTemplate) => {
    setSelected(template);
    setDialogOpen(true);
  }, []);

  const openZones = useCallback((template: PaperworkTemplate) => {
    setSelected(template);
    setZonesOpen(true);
  }, []);

  const closeDialog = useCallback(() => {
    setDialogOpen(false);
    setSelected(null);
  }, []);

  const closeZones = useCallback(() => {
    setZonesOpen(false);
    setSelected(null);
  }, []);

  const saveTemplate = useCallback(
    async (data: CreatePaperworkTemplateInput) => {
      setSaving(true);
      try {
        if (selected) {
          // PDF-only: kind + file UUID travel on edit; body_html is legacy
          // and never sent.
          const patch: UpdatePaperworkTemplateInput = {
            title: data.title,
            is_active: data.is_active,
          };
          if (data.source !== undefined) patch.source = data.source;
          if (data.pdf_file !== undefined) patch.pdf_file = data.pdf_file;
          await updateTemplate(selected.id, patch);
          toast.success("Template updated");
        } else {
          await createTemplate(data);
          toast.success("Template created");
        }
        closeDialog();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Save failed");
      } finally {
        setSaving(false);
      }
    },
    [selected, createTemplate, updateTemplate, closeDialog]
  );

  const saveZones = useCallback(
    async (template: PaperworkTemplate, zones: PaperworkZone[]) => {
      setSaving(true);
      try {
        await updateTemplate(template.id, { zones });
        toast.success(`Saved ${zones.length} zone${zones.length === 1 ? "" : "s"}`);
        closeZones();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Zone save failed");
      } finally {
        setSaving(false);
      }
    },
    [updateTemplate, closeZones]
  );

  return useMemo(
    () => ({
      templates,
      isLoading,
      isError,
      error,
      refetch,
      selected,
      dialogOpen,
      zonesOpen,
      saving,
      openCreate,
      openEdit,
      openZones,
      closeDialog,
      closeZones,
      saveTemplate,
      saveZones,
    }),
    [
      templates,
      isLoading,
      isError,
      error,
      refetch,
      selected,
      dialogOpen,
      zonesOpen,
      saving,
      openCreate,
      openEdit,
      openZones,
      closeDialog,
      closeZones,
      saveTemplate,
      saveZones,
    ]
  );
}
