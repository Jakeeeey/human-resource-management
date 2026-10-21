"use client";

import React, { useState } from "react";
import { useCompanyPermits } from "./hooks/useCompanyPermits";
import { PermitHeader } from "./components/PermitHeader";
import { PermitCatalogGrid } from "./components/PermitCatalogGrid";
import { CompanyPermitFormDialog } from "./components/CompanyPermitFormDialog";
import { CompanyPermitPreviewDialog } from "./components/CompanyPermitPreviewDialog";
import {
  PermitTypeItem,
  CompanyPermitRecord,
  PermitFormData,
} from "./types/permit.types";

export default function CompanyPermitModule() {
  const {
    summary,
    slots,
    permitTypes,
    isLoading,
    isSubmitting,
    searchTerm,
    setSearchTerm,
    statusFilter,
    setStatusFilter,
    refetch,
    addPermit,
    updatePermit,
      } = useCompanyPermits();

  // Dialog states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isRenewalMode, setIsRenewalMode] = useState(false);
  const [selectedPermitTypeForForm, setSelectedPermitTypeForForm] = useState<PermitTypeItem | null>(null);
  const [editRecord, setEditRecord] = useState<CompanyPermitRecord | null>(null);

  // Preview Dialog states
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewPermit, setPreviewPermit] = useState<CompanyPermitRecord | null>(null);
  const [previewHistory, setPreviewHistory] = useState<CompanyPermitRecord[]>([]);

  // Handlers
  const handleOpenUploadNew = () => {
    setIsRenewalMode(false);
    setEditRecord(null);
    setSelectedPermitTypeForForm(null);
    setIsFormOpen(true);
  };

  const handleUploadForType = (type: PermitTypeItem) => {
    setIsRenewalMode(false);
    setEditRecord(null);
    setSelectedPermitTypeForForm(type);
    setIsFormOpen(true);
  };

  const handleEditPermit = (permit: CompanyPermitRecord) => {
    const matchedType = permitTypes.find((t) => String(t.id) === String(permit.permit_type_id)) || null;
    setIsRenewalMode(false);
    setEditRecord(permit);
    setSelectedPermitTypeForForm(matchedType);
    setIsFormOpen(true);
  };

  const handleRenewPermit = (permit: CompanyPermitRecord) => {
    const matchedType = permitTypes.find((t) => String(t.id) === String(permit.permit_type_id)) || null;
    setIsRenewalMode(true);
    setEditRecord(permit);
    setSelectedPermitTypeForForm(matchedType);
    setIsFormOpen(true);
  };

  const handleViewPermit = (permit: CompanyPermitRecord, history: CompanyPermitRecord[]) => {
    setPreviewPermit(permit);
    setPreviewHistory(history);
    setIsPreviewOpen(true);
  };

  const handleFormSubmit = async (formData: PermitFormData): Promise<boolean> => {
    if (isRenewalMode) {
      const payload = { ...formData };
      delete payload.id;
      return await addPermit(payload);
    }

    if (formData.id) {
      return await updatePermit(formData.id, formData);
    } else {
      return await addPermit(formData);
    }
  };

  return (
    <div className="w-full space-y-6">
      <PermitHeader
        summary={summary}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        isLoading={isLoading}
        onRefresh={refetch}
        onOpenUploadNew={handleOpenUploadNew}
      />

      <PermitCatalogGrid
        slots={slots}
        isLoading={isLoading}
        onUpload={handleUploadForType}
        onView={handleViewPermit}
        onEdit={handleEditPermit}
        onRenew={handleRenewPermit}
      />

      {/* Upload / Edit / Renew Modal */}
      <CompanyPermitFormDialog
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSubmit={handleFormSubmit}
        isSubmitting={isSubmitting}
        permitTypes={permitTypes}
        initialPermitType={selectedPermitTypeForForm}
        editRecord={editRecord}
        isRenewalMode={isRenewalMode}
      />

      {/* Document Preview & Pan/Zoom Modal */}
      <CompanyPermitPreviewDialog
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        permit={previewPermit}
        history={previewHistory}
        onEdit={(p) => {
          setIsPreviewOpen(false);
          handleEditPermit(p);
        }}
        onRenew={(p) => {
          setIsPreviewOpen(false);
          handleRenewPermit(p);
        }}
      />
    </div>
  );
}