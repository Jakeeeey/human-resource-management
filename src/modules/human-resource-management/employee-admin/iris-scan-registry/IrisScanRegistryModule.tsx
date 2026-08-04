"use client";

import { useState } from "react";
import { 
    Users, 
    ScanFace,
    AlertCircle,
    CheckCircle2,
    Fingerprint
} from "lucide-react";
import { RegistryTable } from "./components/RegistryTable";
import { useIrisRegistry } from "./hooks/useIrisRegistry";
import { Alert } from "@/components/ui/alert";
import { IrishRegistrationModal } from "../employee-masterlist/components/IrishRegistrationModal";
import type { User } from "../employee-masterlist/types";
import { Card, CardContent } from "@/components/ui/card";

export function IrisScanRegistryModule() {
  const {
    employees,
    departments,
    isLoading,
    isError,
    totalRegistered,
    totalPending,
    refetch
  } = useIrisRegistry();

  const [isScanModalOpen, setIsScanModalOpen] = useState(false);
  const [selectedScanUser, setSelectedScanUser] = useState<User | null>(null);

  if (isError) {
    return (
      <div className="p-8">
        <Alert variant="destructive" className="max-w-2xl mx-auto shadow-lg border-red-200 bg-red-50/50">
          <AlertCircle className="h-5 w-5" />
          <div className="ml-3">
            <h3 className="font-semibold text-red-800">Connection Error</h3>
            <p className="text-sm text-red-700/80 mt-1">
              Could not load the biometric registry data. Please ensure the backend is running.
            </p>
          </div>
        </Alert>
      </div>
    );
  }

  return (
    <div className="w-full h-full min-h-screen bg-slate-50/50 p-6">
      <div className="flex flex-col space-y-6 max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
              <ScanFace className="h-8 w-8 text-primary" />
              Iris Scan Registry
            </h1>
            <p className="text-muted-foreground text-sm font-medium">
              Monitor and manage employee biometric registrations for the attendance system.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="bg-white border-none shadow-xl shadow-foreground/5 relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                  <Users className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Personnel</p>
                  <p className="text-3xl font-bold text-foreground">{employees.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white border-none shadow-xl shadow-foreground/5 relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-green-500/10 text-green-600 flex items-center justify-center">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Registered Scans</p>
                  <p className="text-3xl font-bold text-green-600">{totalRegistered}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white border-none shadow-xl shadow-foreground/5 relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
                  <Fingerprint className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Pending Scans</p>
                  <p className="text-3xl font-bold text-amber-600">{totalPending}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="bg-white rounded-2xl border-none shadow-xl shadow-foreground/5 overflow-hidden transition-all duration-300">
          <RegistryTable
            data={employees}
            departments={departments}
            isLoading={isLoading}
            onScanIris={(user) => {
              setSelectedScanUser(user);
              setIsScanModalOpen(true);
            }}
          />
        </div>
      </div>

      <IrishRegistrationModal 
        isOpen={isScanModalOpen}
        onOpenChange={(open: boolean) => {
          setIsScanModalOpen(open);
          if (!open) {
            // Refetch after modal closes to update stats if a scan was captured
            refetch();
          }
        }}
        user={selectedScanUser}
      />
    </div>
  );
}
