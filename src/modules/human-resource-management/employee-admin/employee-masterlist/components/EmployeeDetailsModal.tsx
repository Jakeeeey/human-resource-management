"use client";

import React, { useState } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { User as UserIcon, Files, IdCard, Laptop } from "lucide-react";
import { User, Department } from "../types";
import { EditProfileTab } from "./EditProfileTab";
import { EmployeeFilesTab } from "./EmployeeFilesTab";
import { EmployeeAssetsTab } from "./EmployeeAssetsTab";
import { EmployeeIdTab } from "./EmployeeIdTab";
import { cn } from "@/lib/utils";
import { UpdateEmployeePayload } from "../providers/springProvider";

interface EmployeeDetailsModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  user: User | null;
  departments: Department[];
  onUpdateEmployee: (id: number, data: UpdateEmployeePayload) => Promise<void>;
}

type TabType = "profile" | "files" | "id" | "assets";

export function EmployeeDetailsModal({
  isOpen,
  onOpenChange,
  user,
  departments,
  onUpdateEmployee,
}: EmployeeDetailsModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>("profile");

  if (!user) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="!max-w-[85vw] md:!max-w-[1200px] w-full p-0 overflow-hidden gap-0 bg-background/95 backdrop-blur-xl border-none shadow-2xl rounded-2xl">
        <DialogTitle className="sr-only">Employee Details</DialogTitle>
        <DialogDescription className="sr-only">View and edit employee details</DialogDescription>
        <div className="flex bg-muted/20">
          
          {/* Sidebar Tabs */}
          <div className="w-[240px] border-r border-border/50 bg-background/50 flex flex-col pt-6 pb-6 shadow-sm z-10">
            <div className="px-6 mb-6">
              <h2 className="text-sm font-bold tracking-wider text-muted-foreground uppercase">
                Employee Details
              </h2>
            </div>
            
            <div className="flex flex-col gap-1 px-3">
              <TabButton 
                active={activeTab === "profile"} 
                onClick={() => setActiveTab("profile")}
                icon={<UserIcon className="h-4 w-4" />}
                label="Edit Profile" 
              />
              <TabButton 
                active={activeTab === "files"} 
                onClick={() => setActiveTab("files")}
                icon={<Files className="h-4 w-4" />}
                label="201 Files" 
              />
              <TabButton 
                active={activeTab === "id"} 
                onClick={() => setActiveTab("id")}
                icon={<IdCard className="h-4 w-4" />}
                label="Employee ID" 
              />
              <TabButton 
                active={activeTab === "assets"} 
                onClick={() => setActiveTab("assets")}
                icon={<Laptop className="h-4 w-4" />}
                label="Assets & Equipments" 
              />
            </div>
          </div>

          {/* Main Content Area */}
          <div className="flex-1 min-h-[600px] h-[80vh] overflow-y-auto bg-background p-8 relative">
            <div className="max-w-3xl mx-auto">
              {activeTab === "profile" && (
                <div className="space-y-6 animate-in slide-in-from-right-4 fade-in duration-300">
                  <div className="border-b pb-4 mb-2">
                    <h3 className="text-2xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                      Edit Profile
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Update {user.firstName}&apos;s personal and employment information.
                    </p>
                  </div>
                  <EditProfileTab user={user} departments={departments} onUpdateEmployee={onUpdateEmployee} />
                </div>
              )}

              {activeTab === "files" && (
                <div className="space-y-6 animate-in slide-in-from-right-4 fade-in duration-300">
                  <div className="border-b pb-4">
                    <h3 className="text-2xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                      201 Files
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Manage documents and records for {user.firstName}.
                    </p>
                  </div>
                  <EmployeeFilesTab user={user} />
                </div>
              )}

              {activeTab === "id" && (
                <div className="space-y-6 animate-in slide-in-from-right-4 fade-in duration-300">
                  <div className="border-b pb-4">
                    <h3 className="text-2xl font-bold">Employee ID</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Preview and generate ID card for {user.firstName}.
                    </p>
                  </div>
                  <EmployeeIdTab user={user} />
                </div>
              )}

              {activeTab === "assets" && (
                <div className="space-y-6 animate-in slide-in-from-right-4 fade-in duration-300">
                  <div className="border-b pb-4">
                    <h3 className="text-2xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                      Assets & Equipments
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Manage company assets and equipment assigned to {user.firstName}.
                    </p>
                  </div>
                  <EmployeeAssetsTab user={user} departments={departments} />
                </div>
              )}
            </div>
          </div>

        </div>
      </DialogContent>
    </Dialog>
  );
}

function TabButton({ 
  active, 
  onClick, 
  icon, 
  label 
}: { 
  active: boolean; 
  onClick: () => void; 
  icon: React.ReactNode; 
  label: string; 
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 text-left",
        active 
          ? "bg-primary text-white shadow-md shadow-primary/20 scale-[1.02]" 
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
