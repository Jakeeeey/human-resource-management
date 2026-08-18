"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Search, Eye, EyeOff, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { AttendanceModificationTable } from "./AttendanceModificationTable";
import { fetchModificationRequests } from "../providers/fetchProvider";
import type { AttendanceChangeRequestWithUser } from "../type";

export function AttendanceModificationRequests() {
  const [searchTerm, setSearchTerm] = useState("");
  const [requests, setRequests] = useState<AttendanceChangeRequestWithUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showResolved, setShowResolved] = useState(false);

  const loadRequests = useCallback(async () => {
    try {
      setIsLoading(true);
      const status = showResolved ? "all" : "pending";
      const response = await fetchModificationRequests(status);
      setRequests(response.data || []);
    } catch {
      toast.error("Failed to load modification requests");
    } finally {
      setIsLoading(false);
    }
  }, [showResolved]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const filteredRequests = requests.filter(req => {
    const fullName = `${req.user_fname} ${req.user_lname}`.toLowerCase();
    const searchLower = searchTerm.toLowerCase();
    return (
      fullName.includes(searchLower) ||
      (req.reason && req.reason.toLowerCase().includes(searchLower))
    );
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Filters Bar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-card/50 p-4 rounded-2xl border border-border/50 backdrop-blur-sm shadow-sm">
        <div className="flex items-center gap-4 w-full md:w-auto">
          
          <div className="relative flex-1 md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or reason..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 rounded-xl border-muted-foreground/20 bg-background/50 focus-visible:ring-primary/20 h-10"
            />
          </div>

          <div className="flex items-center gap-2 bg-background/50 border border-muted-foreground/20 px-3 py-2 rounded-xl h-10 ml-2">
            <Checkbox 
              id="show-resolved" 
              checked={showResolved} 
              onCheckedChange={(checked) => setShowResolved(checked === true)}
              className="border-primary/50 data-[state=checked]:bg-primary"
            />
            <label
              htmlFor="show-resolved"
              className="text-sm font-bold text-muted-foreground cursor-pointer select-none whitespace-nowrap flex items-center gap-1.5"
            >
              {showResolved ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
              Show Resolved
            </label>
          </div>
        </div>

        <Button 
          variant="outline" 
          onClick={loadRequests}
          disabled={isLoading}
          className="rounded-xl h-10 gap-2 border-primary/20 hover:bg-primary/5 text-primary"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Table Section */}
      <div className="bg-card rounded-2xl border shadow-xl shadow-foreground/5 overflow-hidden transition-all duration-300 min-h-[400px]">
        <AttendanceModificationTable 
          data={filteredRequests}
          isLoading={isLoading}
          onRefresh={loadRequests}
        />
      </div>
    </div>
  );
}
