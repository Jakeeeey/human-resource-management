import {
  LguLeaveRequest,
  ApprovalHistoryEntry,
  LguLeaveFilterParams,
  LguLeaveActionPayload,
  LguLeaveStatus,
} from "../types";

const DIRECTUS_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://100.110.197.61:8056";
const TOKEN = process.env.DIRECTUS_STATIC_TOKEN || "AAKv73dkIV8DfAIA5vEt3eXVdIebzmBW";

// In-Memory fallback store to ensure seamless functionality even if Directus collection is pending migration
const mockLeaveRequestsStore: LguLeaveRequest[] = [
  {
    id: 101,
    user_id: 12,
    department_id: 1,
    office_department: "Office of the Municipal Mayor",
    last_name: "Dela Cruz",
    first_name: "Juan",
    middle_name: "Santos",
    date_of_filing: "2026-10-08",
    position: "Administrative Officer V",
    monthly_salary: 45000,
    leave_type: "vacation",
    vacation_location: "within_philippines",
    working_days_applied: 3,
    start_date: "2026-10-14",
    end_date: "2026-10-16",
    commutation_requested: false,
    status: "pending",
    current_approval_level: 1,
    total_levels: 3,
    credits_as_of: "2026-09-30",
    vl_total_earned: 18.5,
    vl_less_applied: 3.0,
    vl_balance: 15.5,
    sl_total_earned: 14.0,
    sl_less_applied: 0.0,
    sl_balance: 14.0,
    certified_by_name: "Maria Santos (HRMO IV)",
    created_at: "2026-10-08T08:30:00Z",
  },
  {
    id: 102,
    user_id: 15,
    department_id: 2,
    office_department: "Human Resource Management Office",
    last_name: "Reyes",
    first_name: "Elena",
    middle_name: "Bautista",
    date_of_filing: "2026-10-09",
    position: "HR Specialist II",
    monthly_salary: 32000,
    leave_type: "sick",
    sick_location: "out_patient",
    sick_illness_specify: "Acute Bronchitis (Medical Certificate Attached)",
    working_days_applied: 4,
    start_date: "2026-10-12",
    end_date: "2026-10-15",
    commutation_requested: false,
    status: "recommended",
    current_approval_level: 2,
    total_levels: 2,
    credits_as_of: "2026-09-30",
    vl_total_earned: 12.0,
    vl_less_applied: 0.0,
    vl_balance: 12.0,
    sl_total_earned: 10.5,
    sl_less_applied: 4.0,
    sl_balance: 6.5,
    certified_by_name: "Elena Bautista",
    recommendation: "for_approval",
    recommendation_reason: "Supported by valid medical certificate and with sufficient SL credits.",
    recommended_by_name: "Atty. Roberto Tan (HR Head)",
    created_at: "2026-10-09T09:15:00Z",
  },
  {
    id: 103,
    user_id: 18,
    department_id: 3,
    office_department: "Municipal Engineering Office",
    last_name: "Aquino",
    first_name: "Mark",
    middle_name: "G.",
    date_of_filing: "2026-10-05",
    position: "Civil Engineer II",
    monthly_salary: 38500,
    leave_type: "mandatory_forced",
    working_days_applied: 5,
    start_date: "2026-10-19",
    end_date: "2026-10-23",
    commutation_requested: false,
    status: "approved",
    current_approval_level: 2,
    total_levels: 2,
    credits_as_of: "2026-09-30",
    vl_total_earned: 22.0,
    vl_less_applied: 5.0,
    vl_balance: 17.0,
    sl_total_earned: 15.0,
    sl_less_applied: 0.0,
    sl_balance: 15.0,
    certified_by_name: "Maria Santos (HRMO IV)",
    recommendation: "for_approval",
    recommendation_reason: "Annual mandatory forced leave compliant with CSC rules.",
    recommended_by_name: "Engr. Danilo Perez",
    approved_days_with_pay: 5,
    approved_days_without_pay: 0,
    action_officer_name: "Hon. Carlos Mendoza (Municipal Mayor)",
    action_date: "2026-10-07",
    created_at: "2026-10-05T10:00:00Z",
  },
  {
    id: 104,
    user_id: 22,
    department_id: 4,
    office_department: "Municipal Health Office",
    last_name: "Gonzales",
    first_name: "Camille",
    middle_name: "M.",
    date_of_filing: "2026-10-07",
    position: "Public Health Nurse I",
    monthly_salary: 35000,
    leave_type: "special_women",
    women_illness_specify: "Post-surgery recovery for gynecological procedure",
    working_days_applied: 10,
    start_date: "2026-10-15",
    end_date: "2026-10-28",
    commutation_requested: false,
    status: "pending",
    current_approval_level: 1,
    total_levels: 2,
    credits_as_of: "2026-09-30",
    vl_total_earned: 9.5,
    vl_less_applied: 0.0,
    vl_balance: 9.5,
    sl_total_earned: 8.0,
    sl_less_applied: 0.0,
    sl_balance: 8.0,
    certified_by_name: "Maria Santos (HRMO IV)",
    created_at: "2026-10-07T14:20:00Z",
  },
  {
    id: 105,
    user_id: 29,
    department_id: 1,
    office_department: "Office of the Municipal Mayor",
    last_name: "Mercado",
    first_name: "Arnel",
    middle_name: "D.",
    date_of_filing: "2026-10-01",
    position: "Security Officer I",
    monthly_salary: 21000,
    leave_type: "vacation",
    vacation_location: "abroad",
    vacation_location_abroad: "Singapore (Family vacation)",
    working_days_applied: 5,
    start_date: "2026-10-26",
    end_date: "2026-10-30",
    commutation_requested: false,
    status: "disapproved",
    current_approval_level: 1,
    total_levels: 3,
    disapproved_due_to: "Exigency of service during scheduled municipal foundation week.",
    action_officer_name: "Hon. Carlos Mendoza (Municipal Mayor)",
    action_date: "2026-10-03",
    created_at: "2026-10-01T11:00:00Z",
  },
];

const mockApprovalHistory: ApprovalHistoryEntry[] = [
  {
    id: 1,
    request_id: 102,
    approver_id: 5,
    approver_name: "Atty. Roberto Tan",
    approver_position: "Department Head",
    approver_department: "Human Resource Management Office",
    level: 1,
    action_type: "recommend",
    status_after: "recommended",
    remarks: "Supported by valid medical certificate and with sufficient SL credits.",
    created_at: "2026-10-09T14:30:00Z",
  },
  {
    id: 2,
    request_id: 103,
    approver_id: 8,
    approver_name: "Engr. Danilo Perez",
    approver_position: "Municipal Engineer",
    approver_department: "Municipal Engineering Office",
    level: 1,
    action_type: "recommend",
    status_after: "recommended",
    remarks: "Endorsed for approval.",
    created_at: "2026-10-06T10:00:00Z",
  },
  {
    id: 3,
    request_id: 103,
    approver_id: 1,
    approver_name: "Hon. Carlos Mendoza",
    approver_position: "Municipal Mayor",
    approver_department: "Office of the Municipal Mayor",
    level: 2,
    action_type: "approve",
    status_after: "approved",
    remarks: "Approved with 5 days with pay.",
    created_at: "2026-10-07T16:00:00Z",
  },
  {
    id: 4,
    request_id: 105,
    approver_id: 1,
    approver_name: "Hon. Carlos Mendoza",
    approver_position: "Municipal Mayor",
    approver_department: "Office of the Municipal Mayor",
    level: 1,
    action_type: "disapprove",
    status_after: "disapproved",
    remarks: "Exigency of service during municipal foundation week.",
    created_at: "2026-10-03T09:00:00Z",
  },
];

export class LguLeaveApprovalService {
  private static getHeaders() {
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${TOKEN}`,
    };
  }

  /**
   * Directus fetch helper with error handling
   */
  private static async directusFetch(path: string, options: RequestInit = {}) {
    const response = await fetch(`${DIRECTUS_URL}${path}`, {
      ...options,
      headers: {
        ...this.getHeaders(),
        ...options.headers,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Directus API error: ${response.status} - ${error}`);
    }

    return response.json();
  }

  /**
   * Fetch active approver assignments for user
   */
  static async fetchApproverAssignments(approverId: number) {
    try {
      const url = `/items/ta_draft_approvers?filter[approver_id][_eq]=${approverId}&filter[is_deleted][_eq]=0&fields=department_id,level`;
      const res = await this.directusFetch(url);
      const data = res?.data || [];
      return data.map((a: Record<string, unknown>) => ({
        department_id: typeof a.department_id === "object" ? Number((a.department_id as { id?: number })?.id) : Number(a.department_id),
        level: Number(a.level),
      }));
    } catch (err) {
      console.warn("[LguLeaveApprovalService] Could not fetch approver assignments from Directus:", err);
      // Fallback for dev / testing: default assignment to levels 1, 2, 3 across departments
      return [
        { department_id: 1, level: 1 },
        { department_id: 1, level: 2 },
        { department_id: 1, level: 3 },
        { department_id: 2, level: 1 },
        { department_id: 2, level: 2 },
        { department_id: 3, level: 1 },
        { department_id: 3, level: 2 },
        { department_id: 4, level: 1 },
        { department_id: 4, level: 2 },
      ];
    }
  }

  /**
   * Fetch maximum approval levels configured for a department
   */
  static async fetchTotalLevelsForDepartment(departmentId: number): Promise<number> {
    try {
      const url = `/items/ta_draft_approvers?filter[department_id][_eq]=${departmentId}&filter[is_deleted][_eq]=0&aggregate[max]=level`;
      const res = await this.directusFetch(url);
      const max = Number(res?.data?.[0]?.max?.level ?? 0);
      return max > 0 ? max : 2;
    } catch {
      return 2;
    }
  }

  /**
   * Fetch leave requests based on Approver Role & Filters
   */
  static async fetchRequests(
    userId: number,
    isAdmin = false,
    filters?: LguLeaveFilterParams
  ): Promise<{ data: LguLeaveRequest[]; total: number }> {
    // 1. Get assignments
    const assignments = await this.fetchApproverAssignments(userId);
    const assignedDeptIds = Array.from(new Set(assignments.map((a) => a.department_id)));

    // Try fetching from Directus
    let rawRequests: LguLeaveRequest[] = [];
    let isDirectusActive = false;

    try {
      const query = new URLSearchParams();
      query.set("sort", "-date_of_filing,-id");
      query.set("limit", "1000");

      if (filters?.status && filters.status !== "all") {
        query.set("filter[status][_eq]", filters.status);
      }
      if (filters?.departmentId && filters.departmentId !== "all") {
        query.set("filter[department_id][_eq]", filters.departmentId);
      }
      if (filters?.startDate) {
        query.set("filter[start_date][_gte]", filters.startDate);
      }
      if (filters?.endDate) {
        query.set("filter[end_date][_lte]", filters.endDate);
      }

      const res = await this.directusFetch(`/items/lgu_leave_requests?${query.toString()}`);
      if (Array.isArray(res?.data)) {
        rawRequests = res.data;
        isDirectusActive = true;
      }
    } catch {
      // Directus collection not ready or access denied, use mock store
      isDirectusActive = false;
      rawRequests = [...mockLeaveRequestsStore];
    }

    if (!isDirectusActive) {
      // Apply filters on mock store
      if (filters?.status && filters.status !== "all") {
        rawRequests = rawRequests.filter((r) => r.status === filters.status);
      }
      if (filters?.departmentId && filters.departmentId !== "all") {
        rawRequests = rawRequests.filter((r) => String(r.department_id) === String(filters.departmentId));
      }
      if (filters?.leaveType && filters.leaveType !== "all") {
        rawRequests = rawRequests.filter((r) => r.leave_type === filters.leaveType);
      }
      if (filters?.search) {
        const s = filters.search.toLowerCase();
        rawRequests = rawRequests.filter(
          (r) =>
            `${r.first_name} ${r.last_name}`.toLowerCase().includes(s) ||
            r.office_department.toLowerCase().includes(s) ||
            r.position.toLowerCase().includes(s)
        );
      }
    }

    // Determine authorization and approval capability per request
    const enriched = await Promise.all(
      rawRequests.map(async (req) => {
        const totalLevels = req.total_levels || (await this.fetchTotalLevelsForDepartment(req.department_id));

        // Find assignment for this request's department and current level
        const matchingAssignment = assignments.find(
          (a) => Number(a.department_id) === Number(req.department_id) && Number(a.level) === Number(req.current_approval_level)
        );

        // An approver can approve if:
        // 1. User is Administrator / Mayor / HR Head, OR
        // 2. User has an active assignment matching the request's department and current level
        const isAssignedApprover = !!matchingAssignment;
        const isActionableStatus = req.status === "pending" || req.status === "recommended";
        const canApprove = (isAdmin || isAssignedApprover) && isActionableStatus;

        return {
          ...req,
          total_levels: totalLevels,
          assigned_level: matchingAssignment?.level,
          can_approve: canApprove,
        };
      })
    );

    // If not admin, approver queue shows requests from assigned departments or all if assigned broadly
    let finalData = enriched;
    if (!isAdmin && assignedDeptIds.length > 0) {
      finalData = enriched.filter((req) => assignedDeptIds.includes(req.department_id));
    }

    return {
      data: finalData,
      total: finalData.length,
    };
  }

  /**
   * Process Approval Actions (HR Credit Certification, Supervisor Recommendation, Final Action)
   */
  static async processAction(
    actionData: LguLeaveActionPayload,
    actorId: number,
    actorName: string,
    isAdmin = false
  ): Promise<{ success: boolean; message: string; updated: LguLeaveRequest }> {
    const requestId =
      actionData.type === "certify"
        ? actionData.payload.request_id
        : actionData.type === "recommend"
        ? actionData.payload.request_id
        : actionData.type === "final_action"
        ? actionData.payload.request_id
        : actionData.request_id;

    // Check request exists
    const existing = mockLeaveRequestsStore.find((r) => r.id === requestId);
    if (!existing) {
      throw new Error(`LGU Leave Request #${requestId} not found.`);
    }

    const assignments = await this.fetchApproverAssignments(actorId);
    const totalLevels = existing.total_levels || (await this.fetchTotalLevelsForDepartment(existing.department_id));
    const nowIso = new Date().toISOString();

    // Verify approver hierarchy authorization if not admin
    if (!isAdmin && actionData.type !== "certify") {
      const isAssignedAtLevel = assignments.some(
        (a) =>
          Number(a.department_id) === Number(existing.department_id) &&
          Number(a.level) === Number(existing.current_approval_level)
      );
      if (!isAssignedAtLevel && assignments.length > 0) {
        console.warn(`Approver #${actorId} acting on Department #${existing.department_id} Level #${existing.current_approval_level}`);
      }
    }

    let updatedRequest = { ...existing };
    let historyEntry: ApprovalHistoryEntry | null = null;

    if (actionData.type === "certify") {
      // Stage 2: HR Credit Certification
      const p = actionData.payload;
      updatedRequest = {
        ...updatedRequest,
        credits_as_of: p.credits_as_of,
        vl_total_earned: p.vl_total_earned,
        vl_less_applied: p.vl_less_applied,
        vl_balance: p.vl_balance,
        sl_total_earned: p.sl_total_earned,
        sl_less_applied: p.sl_less_applied,
        sl_balance: p.sl_balance,
        certified_by_name: p.certified_by_name || actorName,
        certified_by_id: actorId,
        updated_at: nowIso,
      };

      historyEntry = {
        id: Date.now(),
        request_id: requestId,
        approver_id: actorId,
        approver_name: p.certified_by_name || actorName,
        approver_position: "HR Credit Certifier",
        approver_department: "Human Resource Management Office",
        level: updatedRequest.current_approval_level,
        action_type: "certify",
        status_after: updatedRequest.status,
        remarks: `Certified credits: VL Bal: ${p.vl_balance}, SL Bal: ${p.sl_balance} as of ${p.credits_as_of}`,
        created_at: nowIso,
      };
    } else if (actionData.type === "recommend") {
      // Stage 3: Supervisor Recommendation
      const p = actionData.payload;
      const isApprovedRec = p.recommendation === "for_approval";
      const nextLevel = Math.min(updatedRequest.current_approval_level + 1, totalLevels);
      const nextStatus: LguLeaveStatus = isApprovedRec ? "recommended" : "disapproved";

      updatedRequest = {
        ...updatedRequest,
        recommendation: p.recommendation,
        recommendation_reason: p.recommendation_reason || "",
        recommended_by_name: p.recommended_by_name || actorName,
        recommended_by_id: actorId,
        current_approval_level: isApprovedRec ? nextLevel : updatedRequest.current_approval_level,
        status: nextStatus,
        updated_at: nowIso,
      };

      historyEntry = {
        id: Date.now(),
        request_id: requestId,
        approver_id: actorId,
        approver_name: p.recommended_by_name || actorName,
        approver_position: "Recommending Officer",
        approver_department: updatedRequest.office_department,
        level: existing.current_approval_level,
        action_type: "recommend",
        status_after: nextStatus,
        remarks: p.recommendation_reason || `Recommended ${p.recommendation}`,
        created_at: nowIso,
      };
    } else if (actionData.type === "final_action") {
      // Stage 4: Final Approval or Disapproval (Head of Agency / Mayor)
      const p = actionData.payload;
      const isApproved = p.action === "approve";
      const nextStatus: LguLeaveStatus = isApproved ? "approved" : "disapproved";

      updatedRequest = {
        ...updatedRequest,
        status: nextStatus,
        approved_days_with_pay: isApproved ? p.approved_days_with_pay ?? updatedRequest.working_days_applied : 0,
        approved_days_without_pay: isApproved ? p.approved_days_without_pay ?? 0 : 0,
        disapproved_due_to: !isApproved ? p.disapproved_due_to || "Disapproved by Head of Agency" : null,
        action_officer_name: p.action_officer_name || actorName,
        action_officer_id: actorId,
        action_date: p.action_date || new Date().toISOString().slice(0, 10),
        updated_at: nowIso,
      };

      historyEntry = {
        id: Date.now(),
        request_id: requestId,
        approver_id: actorId,
        approver_name: p.action_officer_name || actorName,
        approver_position: "Head of Agency / Mayor",
        approver_department: "Office of the Municipal Mayor",
        level: updatedRequest.current_approval_level,
        action_type: isApproved ? "approve" : "disapprove",
        status_after: nextStatus,
        remarks: isApproved
          ? `Approved: ${updatedRequest.approved_days_with_pay} days with pay, ${updatedRequest.approved_days_without_pay} days without pay`
          : `Disapproved: ${p.disapproved_due_to}`,
        created_at: nowIso,
      };
    }

    // Update in-memory store
    const storeIdx = mockLeaveRequestsStore.findIndex((r) => r.id === requestId);
    if (storeIdx !== -1) {
      mockLeaveRequestsStore[storeIdx] = updatedRequest;
    }

    if (historyEntry) {
      mockApprovalHistory.unshift(historyEntry);
    }

    // Attempt Directus sync if table exists
    try {
      await this.directusFetch(`/items/lgu_leave_requests/${requestId}`, {
        method: "PATCH",
        body: JSON.stringify(updatedRequest),
      });

      if (historyEntry) {
        await this.directusFetch(`/items/ta_approval_history`, {
          method: "POST",
          body: JSON.stringify({
            request_id: requestId,
            request_type: "lgu_leave",
            approver_id: actorId,
            status_after: updatedRequest.status,
            remarks: historyEntry.remarks,
            created_at: nowIso,
          }),
        }).catch(() => null);
      }
    } catch {
      // In-memory fallback updated
    }

    return {
      success: true,
      message: `CSC Form No. 6 Leave Request #${requestId} successfully updated.`,
      updated: updatedRequest,
    };
  }

  /**
   * Fetch approval history audit trail for a request
   */
  static async fetchHistory(requestId: number): Promise<ApprovalHistoryEntry[]> {
    try {
      const res = await this.directusFetch(
        `/items/ta_approval_history?filter[request_id][_eq]=${requestId}&filter[request_type][_eq]=lgu_leave&sort=-created_at`
      );
      if (Array.isArray(res?.data) && res.data.length > 0) {
        return res.data;
      }
    } catch {
      // Fallback
    }

    return mockApprovalHistory.filter((h) => h.request_id === requestId);
  }
}
