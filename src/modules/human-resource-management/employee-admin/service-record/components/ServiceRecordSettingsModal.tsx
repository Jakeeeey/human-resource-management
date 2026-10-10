"use client";

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import type { ServiceRecordSetting } from "../type";
import { updateServiceRecordSettings } from "../providers/serviceRecordProvider";

interface ServiceRecordSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  setting: ServiceRecordSetting;
  onRefresh: () => void;
}

export function ServiceRecordSettingsModal({
  isOpen,
  onClose,
  setting,
  onRefresh,
}: ServiceRecordSettingsModalProps) {
  const [isSaving, setIsSaving] = useState(false);

  const [agencyName, setAgencyName] = useState(setting.agency_name || "Republic of the Philippines");
  const [subHeader, setSubHeader] = useState(setting.sub_header || "");
  const [officeAddress, setOfficeAddress] = useState(setting.office_address || "");
  const [preparedName, setPreparedName] = useState(setting.default_prepared_by_name || "");
  const [preparedTitle, setPreparedTitle] = useState(setting.default_prepared_by_title || "");
  const [certifiedName, setCertifiedName] = useState(setting.default_certified_by_name || "");
  const [certifiedTitle, setCertifiedTitle] = useState(setting.default_certified_by_title || "");
  const [legalBasisText, setLegalBasisText] = useState(setting.legal_basis_text || "");

  useEffect(() => {
    setAgencyName(setting.agency_name || "Republic of the Philippines");
    setSubHeader(setting.sub_header || "");
    setOfficeAddress(setting.office_address || "");
    setPreparedName(setting.default_prepared_by_name || "");
    setPreparedTitle(setting.default_prepared_by_title || "");
    setCertifiedName(setting.default_certified_by_name || "");
    setCertifiedTitle(setting.default_certified_by_title || "");
    setLegalBasisText(
      setting.legal_basis_text ||
        "Issued in compliance with Executive Order No. 54, dated August 10, 1954 in accordance with Circular No. 54, dated August 10, 1954 of the System."
    );
  }, [setting, isOpen]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSaving(true);
      await updateServiceRecordSettings({
        agency_name: agencyName.trim() || "Republic of the Philippines",
        sub_header: subHeader.trim() || null,
        office_address: officeAddress.trim() || null,
        default_prepared_by_name: preparedName.trim() || null,
        default_prepared_by_title: preparedTitle.trim() || null,
        default_certified_by_name: certifiedName.trim() || null,
        default_certified_by_title: certifiedTitle.trim() || null,
        legal_basis_text: legalBasisText.trim() || null,
      });
      toast.success("Service record settings saved successfully");
      onClose();
      onRefresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update settings");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-lg font-black tracking-tight">
            Service Record PDF Settings
          </DialogTitle>
          <DialogDescription className="text-xs">
            Configure header letterhead, legal compliance footnote, and default signatories.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSave} className="space-y-4 py-2">
          {/* Letterhead */}
          <div className="space-y-3">
            <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Letterhead Details
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Top Agency Line</Label>
              <Input
                value={agencyName}
                onChange={(e) => setAgencyName(e.target.value)}
                placeholder="Republic of the Philippines"
                className="h-9 rounded-xl text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Department / Division Sub-header</Label>
              <Input
                value={subHeader}
                onChange={(e) => setSubHeader(e.target.value)}
                placeholder="e.g. Department of Education"
                className="h-9 rounded-xl text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Office Address / Location</Label>
              <Input
                value={officeAddress}
                onChange={(e) => setOfficeAddress(e.target.value)}
                placeholder="e.g. DepEd Division of Eastern Samar"
                className="h-9 rounded-xl text-xs"
              />
            </div>
          </div>

          {/* Signatories */}
          <div className="space-y-3 pt-2 border-t border-border/40">
            <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Default Signatories
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Prepared By (Name)</Label>
                <Input
                  value={preparedName}
                  onChange={(e) => setPreparedName(e.target.value)}
                  placeholder="e.g. MELISSA O. SESIO"
                  className="h-9 rounded-xl text-xs font-bold"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Prepared By (Title)</Label>
                <Input
                  value={preparedTitle}
                  onChange={(e) => setPreparedTitle(e.target.value)}
                  placeholder="e.g. Admin. Officer II"
                  className="h-9 rounded-xl text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Certified Correct (Name)</Label>
                <Input
                  value={certifiedName}
                  onChange={(e) => setCertifiedName(e.target.value)}
                  placeholder="e.g. JOHN D. ALIDON"
                  className="h-9 rounded-xl text-xs font-bold"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Certified Correct (Title)</Label>
                <Input
                  value={certifiedTitle}
                  onChange={(e) => setCertifiedTitle(e.target.value)}
                  placeholder="e.g. Admin. Officer IV/HRMO II"
                  className="h-9 rounded-xl text-xs"
                />
              </div>
            </div>
          </div>

          {/* Legal Footnote */}
          <div className="space-y-1.5 pt-2 border-t border-border/40">
            <Label className="text-xs font-bold">Executive Order No. 54 Compliance Text</Label>
            <Textarea
              rows={2}
              value={legalBasisText}
              onChange={(e) => setLegalBasisText(e.target.value)}
              className="rounded-xl text-xs leading-relaxed resize-none"
            />
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="rounded-xl h-9 text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSaving}
              className="rounded-xl h-9 text-xs font-bold bg-primary text-primary-foreground"
            >
              {isSaving ? "Saving..." : "Save Settings"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
