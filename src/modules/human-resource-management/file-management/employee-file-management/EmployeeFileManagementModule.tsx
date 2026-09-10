"use client";

import React, { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FolderOpen, Settings2 } from "lucide-react";
import EmployeeFileRecordListModule from "../employee-file-record-list/EmployeeFileRecordListModule";
import EmployeeFileRecordTypeModule from "../employee-file-record-type/EmployeeFileRecordTypeModule";

export default function EmployeeFileManagementModule() {
  const [activeTab, setActiveTab] = useState<"records" | "types">("records");

  return (
    <div className="space-y-6 max-w-[1500px] mx-auto px-6 py-10 animate-in fade-in duration-700">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-2">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-primary/10 rounded-2xl border border-primary/20 shadow-inner">
            <FolderOpen className="h-8 w-8 text-primary shadow-sm" />
          </div>
          <div>
            <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-br from-foreground via-foreground to-foreground/60 bg-clip-text text-transparent italic">
              File Management
            </h1>
            <p className="text-muted-foreground mt-1 text-sm md:text-base max-w-2xl font-medium">
              Manage employee file records and configure file record types
            </p>
          </div>
        </div>
      </div>

      <Tabs 
        value={activeTab} 
        onValueChange={(val) => setActiveTab(val as "records" | "types")}
        className="space-y-8"
      >
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-primary/10 to-transparent rounded-xl" />
          <TabsList className="relative w-full justify-start p-1 bg-background/50 backdrop-blur-xl border border-border/50 rounded-xl shadow-sm overflow-x-auto overflow-y-hidden">
            <TabsTrigger 
              value="records"
              className="flex-shrink-0 gap-2 px-6 py-2.5 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md transition-all duration-300"
            >
              <FolderOpen className="h-4 w-4" />
              File Records
            </TabsTrigger>
            <TabsTrigger 
              value="types"
              className="flex-shrink-0 gap-2 px-6 py-2.5 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md transition-all duration-300"
            >
              <Settings2 className="h-4 w-4" />
              File Types
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="records" className="animate-in slide-in-from-bottom-4 duration-500 fade-in m-0">
          <EmployeeFileRecordListModule />
        </TabsContent>

        <TabsContent value="types" className="animate-in slide-in-from-bottom-4 duration-500 fade-in m-0">
          <EmployeeFileRecordTypeModule />
        </TabsContent>
      </Tabs>
    </div>
  );
}
