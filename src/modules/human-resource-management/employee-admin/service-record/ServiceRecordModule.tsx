"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Plus, Printer, Settings2, FileText, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { EmployeeSelector } from "./components/EmployeeSelector";
import { EmployeeHeaderCard } from "./components/EmployeeHeaderCard";
import { ServiceRecordTable } from "./components/ServiceRecordTable";
import { ServiceRecordEntryModal } from "./components/ServiceRecordEntryModal";
import { ServiceRecordSettingsModal } from "./components/ServiceRecordSettingsModal";
import { ServiceRecordPdfPreviewModal } from "./components/ServiceRecordPdfPreviewModal";
import type { ServiceRecordDataResponse, ServiceRecordEntry } from "./type";
import {
  fetchServiceRecordData,
  createServiceRecordEntry,
  updateServiceRecordEntry,
  deleteServiceRecordEntry,
} from "./providers/serviceRecordProvider";

interface ServiceRecordModuleProps {
  initialUserId?: number;
}

export function ServiceRecordModule({ initialUserId }: ServiceRecordModuleProps) {
  const [selectedUserId, setSelectedUserId] = useState<number | null>(initialUserId || null);
  const [data, setData] = useState<ServiceRecordDataResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Modals state
  const [isEntryModalOpen, setIsEntryModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<ServiceRecordEntry | null>(null);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isPdfPreviewOpen, setIsPdfPreviewOpen] = useState(false);

  const loadData = useCallback(async () => {
    if (!selectedUserId) {
      setData(null);
      return;
    }
    try {
      setIsLoading(true);
      const res = await fetchServiceRecordData(selectedUserId);
      setData(res);
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Failed to load service record");
    } finally {
      setIsLoading(false);
    }
  }, [selectedUserId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleOpenAddEntry = () => {
    setEditingEntry(null);
    setIsEntryModalOpen(true);
  };

  const handleOpenEditEntry = (entry: ServiceRecordEntry) => {
    setEditingEntry(entry);
    setIsEntryModalOpen(true);
  };

  const handleSaveEntry = async (
    entryData: Omit<ServiceRecordEntry, "service_record_id">
  ) => {
    try {
      if (editingEntry) {
        await updateServiceRecordEntry(editingEntry.service_record_id, entryData);
        toast.success("Service record updated successfully");
      } else {
        await createServiceRecordEntry(entryData);
        toast.success("Service record entry added successfully");
      }
      loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save entry");
      throw err;
    }
  };

  const handleDeleteEntry = async (entryId: number) => {
    if (!confirm("Are you sure you want to delete this service record entry?")) {
      return;
    }
    try {
      await deleteServiceRecordEntry(entryId);
      toast.success("Entry deleted successfully");
      loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete entry");
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Top Action & Selector Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 bg-card/60 p-4 rounded-2xl border border-border/50 backdrop-blur-sm shadow-xs">
        <EmployeeSelector
          selectedUserId={selectedUserId}
          onSelectEmployee={(uid) => setSelectedUserId(uid)}
          isLoading={isLoading}
        />

        <div className="flex items-center gap-2 flex-wrap">
          {selectedUserId && (
            <Button
              variant="outline"
              size="sm"
              onClick={loadData}
              disabled={isLoading}
              className="h-10 rounded-xl px-3 border-border/60"
              title="Refresh data"
            >
              <RefreshCw className={isLoading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
            </Button>
          )}

          {data && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsSettingsModalOpen(true)}
                className="h-10 rounded-xl px-3.5 text-xs font-bold gap-1.5 border-border/60"
              >
                <Settings2 className="h-4 w-4 text-muted-foreground" />
                PDF Settings
              </Button>

              <Button
                size="sm"
                variant="outline"
                onClick={handleOpenAddEntry}
                className="h-10 rounded-xl px-4 text-xs font-bold gap-1.5 border-primary/30 text-primary hover:bg-primary/5"
              >
                <Plus className="h-4 w-4" />
                Add Entry
              </Button>

              <Button
                size="sm"
                onClick={() => setIsPdfPreviewOpen(true)}
                className="h-10 rounded-xl px-5 text-xs font-bold gap-2 bg-primary text-primary-foreground shadow-md shadow-primary/20 active:scale-95 transition-all"
              >
                <Printer className="h-4 w-4" />
                Generate / Print PDF
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="text-xs font-bold text-muted-foreground">
              Loading employee service record...
            </span>
          </div>
        </div>
      ) : data ? (
        <div className="space-y-6">
          {/* Employee Profile Header Block */}
          <EmployeeHeaderCard
            employee={data.employee}
            isStillInService={data.is_still_in_service}
            onRefresh={loadData}
          />

          {/* Service Record Table */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black uppercase tracking-wider text-foreground">
                  Appointment & Service History
                </h3>
                <p className="text-xs text-muted-foreground">
                  Official chronology of appointments, promotions, and salary adjustments
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleOpenAddEntry}
                className="h-8 rounded-xl text-xs font-bold gap-1"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Row
              </Button>
            </div>

            <ServiceRecordTable
              records={data.records}
              isStillInService={data.is_still_in_service}
              onEditEntry={handleOpenEditEntry}
              onDeleteEntry={handleDeleteEntry}
              isLoading={isLoading}
            />
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center p-16 text-center border border-dashed rounded-2xl bg-card/40">
          <div className="h-14 w-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-3.5 shadow-inner">
            <FileText className="h-7 w-7" />
          </div>
          <h3 className="text-base font-black text-foreground">Employee Service Record</h3>
          <p className="text-xs text-muted-foreground max-w-sm mt-1 leading-relaxed">
            Please search and select an employee from the dropdown above to view, manage, and print their official Civil Service Service Record.
          </p>
        </div>
      )}

      {/* Entry Modal */}
      {selectedUserId && (
        <ServiceRecordEntryModal
          isOpen={isEntryModalOpen}
          onClose={() => setIsEntryModalOpen(false)}
          onSave={handleSaveEntry}
          editingEntry={editingEntry}
          userId={selectedUserId}
        />
      )}

      {/* Settings Modal */}
      {data && (
        <ServiceRecordSettingsModal
          isOpen={isSettingsModalOpen}
          onClose={() => setIsSettingsModalOpen(false)}
          setting={data.setting}
          onRefresh={loadData}
        />
      )}

      {/* PDF Preview Modal */}
      {data && (
        <ServiceRecordPdfPreviewModal
          isOpen={isPdfPreviewOpen}
          onClose={() => setIsPdfPreviewOpen(false)}
          data={data}
        />
      )}
    </div>
  );
}

export default ServiceRecordModule;
