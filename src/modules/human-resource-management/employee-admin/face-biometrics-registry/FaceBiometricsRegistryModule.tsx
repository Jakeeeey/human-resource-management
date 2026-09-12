"use client";

import { useState } from "react";
import { 
    Users, 
    ScanFace,
    AlertCircle,
    CheckCircle2,
    Fingerprint,
    RefreshCw,
    Trash2,
    Loader2
} from "lucide-react";
import { RegistryTable } from "./components/RegistryTable";
import { useFaceRegistry } from "./hooks/useFaceRegistry";
import { Alert } from "@/components/ui/alert";
import { FaceRegistrationModal } from "./components/FaceRegistrationModal";
import type { User } from "./types";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { removeFaceBiometric } from "./providers/fetchProvider";
import { toast } from "sonner";

type EmployeeWithFace = User & { 
  hasFaceBiometric?: boolean; 
  image_reference_path?: string | null;
};

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
  const [selectedScanUser, setSelectedScanUser] = useState<EmployeeWithFace | null>(null);

  // De-registration state
  const [userToRemove, setUserToRemove] = useState<EmployeeWithFace | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);

  const totalEmployees = employees.length;
  const enrollmentRate = totalEmployees > 0 ? Math.round((totalRegistered / totalEmployees) * 100) : 0;

  const handleConfirmRemove = async () => {
    if (!userToRemove) return;
    setIsRemoving(true);
    try {
      const success = await removeFaceBiometric(userToRemove.id);
      if (success) {
        toast.success(`Face biometric removed for ${userToRemove.firstName} ${userToRemove.lastName}.`);
        await refetch();
      } else {
        toast.error("Failed to deactivate biometric record.");
      }
    } catch (err) {
      console.error("Error removing biometric", err);
      toast.error("Failed to remove biometric.");
    } finally {
      setIsRemoving(false);
      setUserToRemove(null);
    }
  };

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
                              <BreadcrumbPage className="truncate max-w-[56vw] sm:max-w-[60vw] md:max-w-none font-semibold">
                                  Face Biometrics Registry
                              </BreadcrumbPage>
                          </BreadcrumbItem>
                      </BreadcrumbList>
                  </Breadcrumb>
              </div>
          </div>

          <div className="pr-4">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => refetch()} 
              className="h-8 rounded-xl text-xs gap-1.5 shadow-sm"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Refresh Data</span>
            </Button>
          </div>
      </header>

      {/* Main Content */}
      <main className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden p-6">
        <div className="flex flex-col space-y-6 max-w-7xl mx-auto">
          {/* Page Header */}
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div className="space-y-1.5">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shadow-sm">
                  <ScanFace className="h-6 w-6" />
                </div>
                Face Biometrics Registry
              </h1>
              <p className="text-muted-foreground text-sm font-medium">
                Enroll, monitor, and manage touchless AI facial biometric credentials for the workforce attendance kiosk.
              </p>
            </div>
          </div>

          {/* Metric Cards Grid with Progress Bar */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Total Personnel Card */}
            <Card className="bg-white border border-slate-100 shadow-sm rounded-2xl relative overflow-hidden group hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Total Workforce</p>
                    <p className="text-3xl font-extrabold text-foreground">{totalEmployees}</p>
                  </div>
                  <div className="h-12 w-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shadow-inner">
                    <Users className="h-6 w-6" />
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-muted-foreground">
                  <span>Active Employees</span>
                  <span className="font-semibold text-foreground">100% Monitored</span>
                </div>
              </CardContent>
            </Card>

            {/* Enrolled Card with Rate Progress */}
            <Card className="bg-white border border-slate-100 shadow-sm rounded-2xl relative overflow-hidden group hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Enrolled Faces</p>
                    <p className="text-3xl font-extrabold text-emerald-600">{totalRegistered}</p>
                  </div>
                  <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center shadow-inner">
                    <CheckCircle2 className="h-6 w-6" />
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-100 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground font-medium">Enrollment Rate</span>
                    <span className="font-bold text-emerald-600">{enrollmentRate}%</span>
                  </div>
                  <Progress value={enrollmentRate} className="h-1.5 bg-slate-100" />
                </div>
              </CardContent>
            </Card>

            {/* Pending Registrations Card */}
            <Card className="bg-white border border-slate-100 shadow-sm rounded-2xl relative overflow-hidden group hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Pending Enrollment</p>
                    <p className="text-3xl font-extrabold text-amber-600">{totalPending}</p>
                  </div>
                  <div className="h-12 w-12 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center shadow-inner">
                    <Fingerprint className="h-6 w-6" />
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-muted-foreground">
                  <span>Awaiting Biometric Scan</span>
                  <span className="font-semibold text-amber-600">{totalPending} remaining</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Registry Table Container */}
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
            <RegistryTable
              data={employees}
              departments={departments}
              isLoading={isLoading}
              onScanFace={(user) => {
                setSelectedScanUser(user);
                setIsScanModalOpen(true);
              }}
              onRemoveBiometric={(user) => {
                setUserToRemove(user);
              }}
            />
          </div>
        </div>

        {/* Modal: Face Registration Flow */}
        <FaceRegistrationModal 
          isOpen={isScanModalOpen}
          onOpenChange={(open: boolean) => {
            setIsScanModalOpen(open);
            if (!open) {
              // Refetch immediately when modal closes to update table & stats
              refetch();
            }
          }}
          user={selectedScanUser}
        />

        {/* Alert Dialog: Remove / Deactivate Biometric Confirmation */}
        <AlertDialog open={!!userToRemove} onOpenChange={(open) => !open && setUserToRemove(null)}>
          <AlertDialogContent className="rounded-3xl max-w-md">
            <AlertDialogHeader>
              <div className="h-12 w-12 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center mb-2">
                <Trash2 className="h-6 w-6" />
              </div>
              <AlertDialogTitle className="text-lg font-bold">
                Remove Face Biometric?
              </AlertDialogTitle>
              <AlertDialogDescription className="text-xs text-muted-foreground leading-relaxed">
                Are you sure you want to deactivate the biometric face profile for{" "}
                <strong className="text-foreground font-semibold">
                  {userToRemove?.firstName} {userToRemove?.lastName}
                </strong>
                ? They will no longer be able to authenticate at attendance terminals until re-registered.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="gap-2 pt-2">
              <AlertDialogCancel className="rounded-xl text-xs">Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleConfirmRemove}
                disabled={isRemoving}
                className="rounded-xl text-xs bg-red-600 hover:bg-red-700 text-white gap-1.5"
              >
                {isRemoving ? (
                  <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Removing...</>
                ) : (
                  "Confirm Deactivation"
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </main>
    </div>
  );
}
