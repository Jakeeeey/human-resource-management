"use client";

import React, { useState } from "react";
import { 
  CalendarCheck, 
  Clock, 
  RefreshCw,
  Timer
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { AttendanceApprovalDaily } from "./components/AttendanceApprovalDaily";
import { AttendanceApprovalCutoff } from "./components/AttendanceApprovalCutoff";
import { cn } from "@/lib/utils";

type TabType = "daily" | "cutoff";

export default function AttendanceApprovalModule() {
  const [activeTab, setActiveTab] = useState<TabType>("daily");
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 800);
  };

  return (
    <div className="space-y-8 w-full px-20 py-6">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2.5 bg-primary/10 rounded-2xl shadow-inner border border-primary/10">
              <CalendarCheck className="h-7 w-7 text-primary" />
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-br from-foreground to-foreground/60 bg-clip-text text-transparent">
              Attendance Approval
            </h1>
          </div>
          <p className="text-muted-foreground text-sm pl-1 font-medium max-w-md">
            Review and finalize employee attendance logs for verification and payroll processing.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-muted/20 p-1 rounded-2xl border border-border/50 backdrop-blur-sm self-start">
          <TabTrigger 
            active={activeTab === "daily"} 
            onClick={() => setActiveTab("daily")}
            icon={<Clock className="h-4 w-4" />}
            label="Daily Approval"
          />
          <TabTrigger 
            active={activeTab === "cutoff"} 
            onClick={() => setActiveTab("cutoff")}
            icon={<Timer className="h-4 w-4" />}
            label="Cutoff Approval"
          />
          <div className="w-[1px] h-4 bg-border/60 mx-1" />
          <Button 
            variant="ghost" 
            size="icon"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="rounded-xl h-9 w-9 transition-all active:rotate-180 duration-500"
          >
            <RefreshCw className={cn("h-4 w-4 text-muted-foreground", isRefreshing && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="min-h-[600px]">
        {activeTab === "daily" && <AttendanceApprovalDaily />}
        {activeTab === "cutoff" && <AttendanceApprovalCutoff />}
      </div>
    </div>
  );
}

function TabTrigger({ 
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
        "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all duration-300",
        active 
          ? "bg-background text-primary shadow-sm border border-border/30 scale-[1.02]" 
          : "text-muted-foreground hover:bg-background/50 hover:text-foreground"
      )}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
