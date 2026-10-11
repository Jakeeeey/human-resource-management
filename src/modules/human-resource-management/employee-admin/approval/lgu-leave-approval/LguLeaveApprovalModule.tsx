"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ShieldCheck, AlertCircle, Layers, SlidersHorizontal } from "lucide-react";

import {
  fetchLguLeaveRequests,
  submitLguLeaveAction,
} from "./providers/lguLeaveApprovalProvider";
import {
  LguLeaveRequest,
  LguLeaveActionPayload,
} from "./types";
import { LguLeaveStats } from "./components/LguLeaveStats";
import { LguLeaveFilters } from "./components/LguLeaveFilters";
import { LguLeaveApprovalTable } from "./components/LguLeaveApprovalTable";
import { CscForm6ReviewModal } from "./components/CscForm6ReviewModal";
import { LguLeaveHistoryModal } from "./components/LguLeaveHistoryModal";

export default function LguLeaveApprovalModule() {
  const [requests, setRequests] = useState<LguLeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // User Role info
  const [currentUser, setCurrentUser] = useState<{
    userId: number;
    userName: string;
    isAdmin: boolean;
  }>({
    userId: 1,
    userName: "Approving Officer",
    isAdmin: true,
  });

  // Filter States
  const [searchQuery, setSearchQuery] = useState("");
  const [leaveTypeFilter, setLeaveTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [activeTab, setActiveTab] = useState<"pending" | "recommended" | "history" | "all">("pending");

  // Modal States
  const [reviewRequest, setReviewRequest] = useState<LguLeaveRequest | null>(null);
  const [historyRequest, setHistoryRequest] = useState<LguLeaveRequest | null>(null);

  // Load Data
  const loadRequests = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      else setRefreshing(true);
      setError(null);

      const response = await fetchLguLeaveRequests({
        status: statusFilter !== "all" ? statusFilter : undefined,
        leaveType: leaveTypeFilter !== "all" ? leaveTypeFilter : undefined,
        search: searchQuery.trim() || undefined,
      });

      setRequests(response.data);
      if (response.userRole) {
        setCurrentUser({
          userId: response.userRole.userId,
          userName: response.userRole.userName,
          isAdmin: response.userRole.isAdmin,
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load leave requests";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [statusFilter, leaveTypeFilter, searchQuery]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const handleResetFilters = () => {
    setSearchQuery("");
    setLeaveTypeFilter("all");
    setStatusFilter("all");
  };

  const handleActionSubmit = async (action: LguLeaveActionPayload) => {
    try {
      const res = await submitLguLeaveAction(action);
      toast.success(res.message);
      // Reload updated records
      await loadRequests(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to submit approval action";
      toast.error(msg);
      throw err;
    }
  };

  // Tab Filtering
  const tabRequests = useMemo(() => {
    let list = [...requests];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (r) =>
          `${r.first_name} ${r.last_name}`.toLowerCase().includes(q) ||
          r.position.toLowerCase().includes(q) ||
          r.office_department.toLowerCase().includes(q)
      );
    }

    if (leaveTypeFilter !== "all") {
      list = list.filter((r) => r.leave_type === leaveTypeFilter);
    }

    if (activeTab === "pending") {
      return list.filter((r) => r.status === "pending");
    } else if (activeTab === "recommended") {
      return list.filter((r) => r.status === "recommended");
    } else if (activeTab === "history") {
      return list.filter((r) => r.status === "approved" || r.status === "disapproved");
    }

    return list;
  }, [requests, activeTab, searchQuery, leaveTypeFilter]);

  return (
    <div className="space-y-6 pb-12">
      {/* Header Banner */}
      <div className="bg-card border rounded-xl p-5 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-primary/10 rounded-lg text-primary">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
                LGU Leave Approval Module
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                  CSC Form No. 6 (Revised 2020)
                </span>
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Multi-level hierarchy approval for Local Government Units: HR Credit Certification, Supervisor Recommendation, & Mayoral Executive Action.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-2 text-xs bg-muted/50 p-2 px-3 rounded-lg border">
            <Layers className="h-4 w-4 text-primary" />
            <span className="text-muted-foreground">Acting as:</span>
            <span className="font-semibold text-foreground">{currentUser.userName}</span>
            {currentUser.isAdmin && (
              <span className="text-[10px] bg-primary/15 text-primary px-1.5 py-0.5 rounded font-bold uppercase">
                Admin
              </span>
            )}
          </div>

          <Button asChild size="sm" variant="outline" className="text-xs h-9 gap-1.5 shadow-2xs font-medium">
            <Link href="/hrm/employee-admin/approval/lgu-leave-approval-hierarchy">
              <SlidersHorizontal className="h-3.5 w-3.5 text-primary" />
              Hierarchy Setup
            </Link>
          </Button>
        </div>
      </div>

      {/* Metric Stats */}
      <LguLeaveStats requests={requests} />

      {/* Filter Bar */}
      <LguLeaveFilters
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        leaveTypeFilter={leaveTypeFilter}
        onLeaveTypeChange={setLeaveTypeFilter}
        statusFilter={statusFilter}
        onStatusChange={setStatusFilter}
        onRefresh={() => loadRequests(true)}
        onReset={handleResetFilters}
        isRefreshing={refreshing}
      />

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-xs">{error}</AlertDescription>
        </Alert>
      )}

      {/* Main Approval Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
        <TabsList className="grid grid-cols-4 w-full sm:w-[540px]">
          <TabsTrigger value="pending" className="text-xs flex items-center gap-1.5">
            Pending Review
            <span className="ml-1 text-[10px] bg-amber-500/15 text-amber-600 px-1.5 py-0.2 rounded-full font-bold">
              {requests.filter((r) => r.status === "pending").length}
            </span>
          </TabsTrigger>
          <TabsTrigger value="recommended" className="text-xs flex items-center gap-1.5">
            Recommended
            <span className="ml-1 text-[10px] bg-blue-500/15 text-blue-600 px-1.5 py-0.2 rounded-full font-bold">
              {requests.filter((r) => r.status === "recommended").length}
            </span>
          </TabsTrigger>
          <TabsTrigger value="history" className="text-xs flex items-center gap-1.5">
            Completed
            <span className="ml-1 text-[10px] bg-emerald-500/15 text-emerald-600 px-1.5 py-0.2 rounded-full font-bold">
              {requests.filter((r) => r.status === "approved" || r.status === "disapproved").length}
            </span>
          </TabsTrigger>
          <TabsTrigger value="all" className="text-xs">
            All Records ({requests.length})
          </TabsTrigger>
        </TabsList>

        <div className="mt-4">
          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center gap-2 border rounded-lg bg-card">
              <Spinner className="h-8 w-8 text-primary" />
              <p className="text-xs text-muted-foreground">Loading LGU leave approval records...</p>
            </div>
          ) : (
            <LguLeaveApprovalTable
              requests={tabRequests}
              onReview={(req) => setReviewRequest(req)}
              onViewHistory={(req) => setHistoryRequest(req)}
            />
          )}
        </div>
      </Tabs>

      {/* CSC Form No. 6 Review & Action Modal */}
      <CscForm6ReviewModal
        request={reviewRequest}
        isOpen={!!reviewRequest}
        onClose={() => setReviewRequest(null)}
        onSubmitAction={handleActionSubmit}
        currentUser={currentUser}
      />

      {/* Approval Audit Trail History Modal */}
      <LguLeaveHistoryModal
        request={historyRequest}
        isOpen={!!historyRequest}
        onClose={() => setHistoryRequest(null)}
      />
    </div>
  );
}
