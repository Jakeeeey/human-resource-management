"use client";

import React, { useState, useEffect } from "react";
import { Search, UserCheck, ChevronDown, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { EmployeeOption } from "../type";
import { fetchEmployeeOptions } from "../providers/serviceRecordProvider";
import { cn } from "@/lib/utils";

interface EmployeeSelectorProps {
  selectedUserId: number | null;
  onSelectEmployee: (userId: number) => void;
  isLoading?: boolean;
}

export function EmployeeSelector({
  selectedUserId,
  onSelectEmployee,
  isLoading,
}: EmployeeSelectorProps) {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [fetching, setFetching] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const loadEmployees = async () => {
      try {
        setFetching(true);
        const data = await fetchEmployeeOptions(searchTerm);
        if (isMounted) setEmployees(data);
      } catch (err) {
        console.error("Failed to load employees", err);
      } finally {
        if (isMounted) setFetching(false);
      }
    };

    const timeout = setTimeout(loadEmployees, 250);
    return () => {
      isMounted = false;
      clearTimeout(timeout);
    };
  }, [searchTerm]);

  const selectedEmployee = employees.find((e) => e.user_id === selectedUserId);

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
      <div className="flex items-center gap-2">
        <div className="h-9 w-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
          <UserCheck className="h-5 w-5" />
        </div>
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block">
            Select Employee
          </span>
          <span className="text-xs text-muted-foreground">
            Search employee to view/print Service Record
          </span>
        </div>
      </div>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={isLoading}
            className="w-full sm:w-[320px] justify-between h-10 rounded-xl bg-background/60 border-muted-foreground/20 font-medium text-xs px-3 shadow-xs"
          >
            {selectedEmployee ? (
              <span className="truncate font-bold text-foreground">
                {selectedEmployee.user_lname}, {selectedEmployee.user_fname} (ID: {selectedEmployee.user_id})
              </span>
            ) : (
              <span className="text-muted-foreground font-normal">Choose an employee...</span>
            )}
            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[340px] p-2 rounded-2xl shadow-2xl border-border bg-background" align="start">
          <div className="relative mb-2">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search by name or ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 h-8 rounded-lg text-xs border-muted-foreground/20"
              autoFocus
            />
          </div>

          <ScrollArea className="h-64">
            {fetching ? (
              <div className="py-6 text-center text-xs text-muted-foreground">
                Loading employees...
              </div>
            ) : employees.length === 0 ? (
              <div className="py-6 text-center text-xs text-muted-foreground">
                No employees found.
              </div>
            ) : (
              <div className="space-y-1">
                {employees.map((emp) => {
                  const isSelected = emp.user_id === selectedUserId;
                  return (
                    <button
                      key={emp.user_id}
                      type="button"
                      onClick={() => {
                        onSelectEmployee(emp.user_id);
                        setOpen(false);
                      }}
                      className={cn(
                        "w-full text-left px-2.5 py-2 rounded-xl text-xs transition-colors flex items-center justify-between group",
                        isSelected
                          ? "bg-primary text-primary-foreground font-bold shadow-xs"
                          : "hover:bg-muted text-foreground"
                      )}
                    >
                      <div className="flex flex-col min-w-0">
                        <span className="truncate font-semibold">
                          {emp.user_lname}, {emp.user_fname} {emp.user_mname ? `${emp.user_mname[0]}.` : ""}
                        </span>
                        <div className="flex items-center gap-1.5 text-[10px] opacity-75">
                          <span>ID: {emp.user_id}</span>
                          {emp.department_name && (
                            <>
                              <span>•</span>
                              <span className="truncate">{emp.department_name}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0 ml-2">
                        {emp.user_position && (
                          <Badge
                            variant={isSelected ? "secondary" : "outline"}
                            className="text-[9px] px-1.5 py-0 h-4"
                          >
                            {emp.user_position}
                          </Badge>
                        )}
                        {isSelected && <Check className="h-3.5 w-3.5" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </PopoverContent>
      </Popover>
    </div>
  );
}
