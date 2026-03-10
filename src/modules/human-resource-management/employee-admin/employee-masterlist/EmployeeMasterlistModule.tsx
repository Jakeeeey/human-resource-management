/**
 * Employee Masterlist Module
 * Connected to Database
 */

"use client";

import React, { useState } from "react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { 
  Users, 
  UserPlus, 
  FileSpreadsheet,
  AlertCircle, 
  RefreshCw 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmployeeTable } from "./components/EmployeeTable";
import { AddEmployeeModal, type NewEmployeeFormData } from "./components/AddEmployeeModal";
import { EmployeeDetailsModal } from "./components/EmployeeDetailsModal";
import type { User } from "./types";
import { useEmployeeMasterlist } from "./hooks/useEmployeeMasterlist";
import { createEmployeeSpring } from "./providers/springProvider";

export default function EmployeeMasterlistModule() {
  const {
    employees,
    departments,
    isLoading,
    isError,
    error,
    refetch,
    removeEmployee,
    updateEmployee,
  } = useEmployeeMasterlist();

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<User | null>(null);

  const handleAddEmployee = async (data: NewEmployeeFormData & { _userImageId?: string; _signatureId?: string }) => {
    try {
      await createEmployeeSpring({
        // Account
        email:        data.user_email,
        hashPassword: data.user_password,
        // Personal
        firstName:  data.user_fname,
        middleName: data.user_mname || undefined,
        lastName:   data.user_lname,
        contact:    data.user_contact,
        birthday:   data.user_bday   || undefined,
        // Address
        province: data.user_province,
        city:     data.user_city,
        brgy:     data.user_brgy,
        // Emergency
        emergencyContactName:   data.emergency_contact_name   || undefined,
        emergencyContactNumber: data.emergency_contact_number || undefined,
        // Work
        department:   data.user_department || undefined,
        position:     data.user_position,
        dateOfHire:   data.user_dateOfHire,
        rfId:         data.rf_id           || undefined,
        tinNumber:    data.user_tin        || undefined,
        sssNumber:    data.user_sss        || undefined,
        philHealthNumber: data.user_philhealth || undefined,
        pagibigNumber:    data.user_pagibig   || undefined,
        admin:        data.isAdmin,
        role:         data.role,
        // Media — Directus file UUIDs from /files upload
        image:     data._userImageId ?? undefined,
        signature: data._signatureId ?? undefined,
      });

      toast.success("Employee added successfully!");
      await refetch();
    } catch (err: unknown) {
      // Spring Boot validation errors come back as { field: "message" } objects.
      // The provider throws with the message string from the error body.
      const raw = err instanceof Error ? err.message : String(err);

      // Try to parse JSON if the error is a serialised object
      let friendly = raw;
      try {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") {
          // Spring Boot validation: { hashPassword: "...", email: "..." }
          friendly = Object.values(parsed).join("\n");
        }
      } catch {
        // raw is already a plain string — use it as-is
      }

      toast.error(friendly || "Failed to add employee. Please try again.", {
        duration: 6000,
      });
      // Re-throw so the modal stays open (handleSubmit catches it)
      throw err;
    }
  };

  if (isError) {
    return (
      <div className="p-8">
        <Alert variant="destructive" className="max-w-2xl mx-auto shadow-lg border-red-200 bg-red-50/50">
          <AlertCircle className="h-5 w-5" />
          <AlertTitle className="text-lg font-bold">Data Fetch Error</AlertTitle>
          <AlertDescription className="mt-2 flex flex-col gap-4">
            <p className="text-red-800">
              {error?.message || "There was a problem connecting to the HR database. Please check your connection or try again later."}
            </p>
            <Button 
                variant="outline" 
                size="sm" 
                onClick={() => refetch()} 
                className="w-fit bg-background hover:bg-red-50 border-red-200"
            >
              <RefreshCw className="mr-2 h-4 w-4" /> Reconnect Now
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-[1400px] mx-auto px-4 py-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="p-2 bg-primary/10 rounded-xl shadow-inner border border-primary/5">
              <Users className="h-7 w-7 text-primary" />
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-br from-foreground to-foreground/60 bg-clip-text text-transparent">
              Employee Masterlist
            </h1>
          </div>
          <p className="text-muted-foreground text-sm pl-12 font-medium">
            System of record for all verified organizational human resources.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" className="rounded-xl shadow-sm border-muted-foreground/20 hover:bg-muted/50 h-10 px-4">
            <FileSpreadsheet className="mr-2 h-4 w-4 text-green-600" />
            Export CSV
          </Button>
          <Button
            size="sm"
            onClick={() => setIsAddModalOpen(true)}
            className="rounded-xl shadow-md h-10 px-4 bg-primary hover:bg-primary/90 transition-all active:scale-95 text-white"
          >
            <UserPlus className="mr-2 h-4 w-4" />
            New Employee
          </Button>
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => refetch()} 
            disabled={isLoading}
            className="rounded-xl hover:bg-muted/50 h-10 w-10 transition-transform active:rotate-180 duration-500"
            title="Refresh Registry"
          >
            <RefreshCw className={`h-4 w-4 text-muted-foreground ${isLoading ? "animate-spin" : ""}`} />
            <span className="sr-only">Refresh</span>
          </Button>
        </div>
      </div>

      <div className="bg-card rounded-3xl border shadow-xl shadow-foreground/5 overflow-hidden transition-all duration-300">
        <EmployeeTable 
            data={employees} 
            departments={departments}
            isLoading={isLoading} 
            onViewDetails={(user) => {
              setSelectedEmployee(user);
              setIsDetailsModalOpen(true);
            }}
            onDeleteEmployee={removeEmployee}
        />
      </div>

      <AddEmployeeModal
        isOpen={isAddModalOpen}
        onOpenChange={setIsAddModalOpen}
        departments={departments}
        onSubmit={handleAddEmployee}
      />

      <EmployeeDetailsModal
        isOpen={isDetailsModalOpen}
        onOpenChange={setIsDetailsModalOpen}
        user={selectedEmployee}
        departments={departments}
        onUpdateEmployee={updateEmployee}
      />
    </div>
  );
}
