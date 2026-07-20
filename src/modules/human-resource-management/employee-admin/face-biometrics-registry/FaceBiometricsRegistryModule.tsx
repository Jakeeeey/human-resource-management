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
import { useFaceRegistry } from "./hooks/useFaceRegistry";
import { Alert } from "@/components/ui/alert";
import { FaceRegistrationModal } from "./components/FaceRegistrationModal";
import type { User } from "./types";
import { Card, CardContent } from "@/components/ui/card";
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
export function FaceBiometricsRegistryModule() {
  const {
    employees,
    departments,
    isLoading,
    isError,
    totalRegistered,
    totalPending,
    refetch
  } = useFaceRegistry();

  const [isScanModalOpen, setIsScanModalOpen] = useState(false);
  const [selectedScanUser, setSelectedScanUser] = useState<(User & { hasFaceBiometric?: boolean }) | null>(null);

  if (isError) {
    return (
      <div className="p-8">
        <Alert variant="destructive" className="max-w-2xl mx-auto shadow-lg border-red-200 bg-red-50/50">
          <AlertCircle className="h-5 w-5" />
          <div className="ml-3">
            <h3 className="font-semibold text-red-800">Connection Error</h3>
            <p className="text-sm text-red-700/80 mt-1">
              Could not load the face biometric registry data. Please ensure the backend is running.
            </p>
          </div>
        </Alert>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-slate-50/50">
      {/* Top Navigation */}
      <header className="relative z-10 flex h-14 shrink-0 items-center justify-between border-b shadow-sm bg-background sm:h-16 overflow-hidden">
          <div className="flex h-full min-w-0 items-center gap-2 px-3 sm:px-4 overflow-hidden">
              <SidebarTrigger className="-ml-1 shrink-0" />
              <Separator
                  orientation="vertical"
                  className="hidden sm:block mr-2 data-[orientation=vertical]:h-4 shrink-0"
              />
              <div className="min-w-0 overflow-hidden">
                  <Breadcrumb>
                      <BreadcrumbList className="min-w-0 overflow-hidden">
                          <BreadcrumbItem className="hidden md:block shrink-0">
                              <BreadcrumbLink href="/hrm">HRM</BreadcrumbLink>
                          </BreadcrumbItem>
                          <BreadcrumbSeparator className="hidden md:block shrink-0" />
                          <BreadcrumbItem className="hidden md:block shrink-0">
                              <span className="text-muted-foreground">Employee Admin</span>
                          </BreadcrumbItem>
                          <BreadcrumbSeparator className="hidden md:block shrink-0" />
                          <BreadcrumbItem className="min-w-0 overflow-hidden">
                              <BreadcrumbPage className="truncate max-w-[56vw] sm:max-w-[60vw] md:max-w-none">
                                  Face Biometrics Registry
                              </BreadcrumbPage>
                          </BreadcrumbItem>
                      </BreadcrumbList>
                  </Breadcrumb>
              </div>
          </div>
      </header>

      {/* Main Content */}
      <main className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden p-6">
        <div className="flex flex-col space-y-6 max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
              <ScanFace className="h-8 w-8 text-primary" />
              Face Biometrics Registry
            </h1>
            <p className="text-muted-foreground text-sm font-medium">
              Monitor and manage employee face biometric registrations for the attendance system.
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
                  <p className="text-sm font-medium text-muted-foreground">Registered Faces</p>
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
                  <p className="text-sm font-medium text-muted-foreground">Pending Registrations</p>
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
            onScanFace={(user) => {
              setSelectedScanUser(user);
              setIsScanModalOpen(true);
            }}
          />
        </div>
      </div>

      <FaceRegistrationModal 
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
      </main>
    </div>
  );
}
