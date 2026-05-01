import { 
  RequestType, 
  TAActionPayload, 
  AnyTARequest,
  HistoryLog,
  ApprovalLogEntry,
  UserDetails,
  Department
} from "../types";

/** Shared filter options passed from the API layer */
interface TAFilterOptions {
  status?: string;
  types?: RequestType[];
  startDate?: string;
  endDate?: string;
  departmentId?: number;
}

/** One row from ta_draft_approvers */
interface ApproverAssignment {
  department_id: number;
  level: number;
}

export class TAApprovalService {
  private static readonly API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;
  private static readonly TOKEN = process.env.DIRECTUS_STATIC_TOKEN;

  private static getHeaders() {
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.TOKEN}`,
    };
  }

  private static getCollection(type: RequestType): string {
    switch (type) {
      case "leave": return "leave_request";
      case "overtime": return "overtime_request";
      case "undertime": return "undertime_request";
      default: return "";
    }
  }

  private static getPkField(type: RequestType): string {
    switch (type) {
      case "leave": return "leave_id";
      case "overtime": return "overtime_id";
      case "undertime": return "undertime_id";
      default: return "";
    }
  }

  // ─── Manager Queue ──────────────────────────────────────────────────────────

  /**
   * Fetches all departments for the HR Head department dropdown.
   */
  static async fetchAllDepartments(): Promise<Department[]> {
    const url = `${this.API_BASE}/items/department?fields=department_id,department_name&sort=department_name`;
    try {
      const res = await fetch(url, { headers: this.getHeaders() });
      if (!res.ok) return [];
      const { data } = await res.json();

      return Array.isArray(data) ? data : [];
    } catch (err) {
      console.error("[TAService] Failed to fetch departments:", err);
      return [];
    }
  }

  /**
   * Fetches only the departments where the specific user is an active approver.
   */
  static async fetchAssignedDepartments(approverId: number): Promise<Department[]> {
    try {
      const assignments = await this.fetchApproverAssignments(approverId);
      if (assignments.length === 0) return [];

      const uniqueDeptIds = Array.from(new Set(assignments.map(a => a.department_id)));
      
      const url = `${this.API_BASE}/items/department` +
        `?filter[department_id][_in]=${uniqueDeptIds.join(",")}` +
        `&fields=department_id,department_name&sort=department_name`;

      const res = await fetch(url, { headers: this.getHeaders() });
      if (!res.ok) return [];
      const { data } = await res.json();
      return Array.isArray(data) ? data : [];
    } catch (err) {
      console.error("[TAService] Failed to fetch assigned departments:", err);
      return [];
    }
  }

  /**
   * Fetches all requests where the user is an assigned approver at the CURRENT level.
   * When isHRHead=true, bypasses assignment check and returns all pending requests.
   */
  static async fetchManagerQueue(
    approverId: number,
    filters?: TAFilterOptions,
    isHRHead = false
  ): Promise<AnyTARequest[]> {
    const results: AnyTARequest[] = [];

    // ── HR Head path: bypass approver assignments, fetch all pending requests ──
    if (isHRHead) {
      const types: RequestType[] = filters?.types && filters.types.length > 0
        ? filters.types
        : ["leave", "overtime", "undertime"];

      for (const type of types) {
        const collection = this.getCollection(type);
        const search = new URLSearchParams();
        search.set("fields", "*,user_id.user_id,user_id.user_fname,user_id.user_lname,user_id.user_position");

        const status = filters?.status && filters.status !== "all" ? filters.status : "pending";
        search.set("filter[status][_eq]", status);

        if (filters?.departmentId) {
          search.set("filter[department_id][_eq]", String(filters.departmentId));
        }
        if (filters?.startDate) search.set("filter[filed_at][_gte]", filters.startDate);
        if (filters?.endDate)   search.set("filter[filed_at][_lte]", filters.endDate);

        const url = `${this.API_BASE}/items/${collection}?${search.toString()}`;
        const res = await fetch(url, { headers: this.getHeaders() });
        if (!res.ok) continue;
        const { data } = await res.json();
        if (!Array.isArray(data)) continue;

        const mapped = await Promise.all(
          data.map(async (item: Record<string, unknown>) => {
            const deptId = typeof item.department_id === "object" ? (item.department_id as { id: number })?.id : item.department_id;
            const totalLevels = await this.fetchTotalLevels(deptId as number | null);
            return { ...item, module_type: type, total_levels: totalLevels, assigned_level: item.current_approval_level };
          })
        );
        results.push(...mapped as AnyTARequest[]);
      }
    } else {
      // ── Regular approver path: only requests at their assigned (dept, level) ──
      const assignments = await this.fetchApproverAssignments(approverId);
      if (assignments.length === 0) return results;

      const types: RequestType[] = filters?.types && filters.types.length > 0
        ? filters.types
        : ["leave", "overtime", "undertime"];

      for (const type of types) {
        const collection = this.getCollection(type);
        const search = new URLSearchParams();
        search.set("fields", "*,user_id.user_id,user_id.user_fname,user_id.user_lname,user_id.user_position");

        // Construct OR filter for each (dept, level) assignment
        // Normalize IDs to string to avoid [object Object] issues
        let activeAssignments = assignments;
        if (filters?.departmentId) {
          activeAssignments = assignments.filter(a => Number(a.department_id) === Number(filters.departmentId));
        }

        if (activeAssignments.length === 0) continue;

        activeAssignments.forEach((a, idx) => {
          const dId = typeof a.department_id === "object" ? (a.department_id as Record<string, unknown>)?.id : a.department_id;
          search.set(`filter[_or][${idx}][department_id][_eq]`, String(dId));
          // We removed the strict level filter so all levels can see the department pool
        });

        const status = filters?.status && filters.status !== "all" ? filters.status : "pending";
        search.set("filter[status][_eq]", status);

        if (filters?.startDate) search.set("filter[filed_at][_gte]", filters.startDate);
        if (filters?.endDate)   search.set("filter[filed_at][_lte]", filters.endDate);

        const url = `${this.API_BASE}/items/${collection}?${search.toString()}`;
        const res = await fetch(url, { headers: this.getHeaders() });
        if (!res.ok) continue;
        const { data } = await res.json();
        if (!Array.isArray(data)) continue;

        const mapped = await Promise.all(
          data.map(async (item: Record<string, unknown>) => {
            const deptId = typeof item.department_id === "object" ? (item.department_id as { id: number })?.id : item.department_id;
            const totalLevels = await this.fetchTotalLevels(deptId as number | null);
            const assignment = assignments.find(a => Number(a.department_id) === Number(deptId));
            return { ...item, module_type: type, total_levels: totalLevels, assigned_level: assignment?.level };
          })
        );
        results.push(...mapped as AnyTARequest[]);
      }
    }

    // Deduplicate (safety — a request should only match one assignment slot)
    const seen = new Set<string>();
    const deduped = results.filter((item) => {
      const pkField = this.getPkField(item.module_type as RequestType);
      const pk = (item as unknown as Record<string, unknown>)[pkField];
      const key = `${item.module_type}:${pk}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    let enriched = deduped;

    // 3. Bulk fetch user details
    const userIds = deduped
      .map((item) => typeof item.user_id === "number" ? item.user_id : (item.user_id as UserDetails)?.user_id)
      .filter((id) => id !== undefined && id !== null);
      
    const uniqueUserIds = Array.from(new Set(userIds)) as number[];
    
    if (uniqueUserIds.length > 0) {
      const userUrl = `${this.API_BASE}/items/user?filter[user_id][_in]=${uniqueUserIds.join(",")}&fields=user_id,user_fname,user_lname,user_position,user_department`;
      try {
        const userRes = await fetch(userUrl, { headers: this.getHeaders() });
        if (userRes.ok) {
          const { data: userData } = await userRes.json();
          const userMap = new Map();
          if (Array.isArray(userData)) {
            userData.forEach((u) => userMap.set(u.user_id, u));
          }
          
          enriched = enriched.map((item) => {
            const uId = typeof item.user_id === "number" ? item.user_id : (item.user_id as UserDetails)?.user_id;
            if (uId && userMap.has(uId)) {
              return { ...item, user_id: userMap.get(uId) };
            }
            return item;
          });
        }
      } catch (err) {
        console.error("[TAService] Failed to bulk fetch users:", err);
      }
    }

    // 4. Bulk fetch department names (BASED ON USER TABLE)
    const deptIds = enriched
      .map((item) => {
        const u = item.user_id as UserDetails | null;
        const uDept = u?.user_department;
        return typeof uDept === "number" ? uDept : (uDept as unknown as { id: number })?.id;
      })
      .filter((id) => id !== undefined && id !== null);
    
    const uniqueDeptIds = Array.from(new Set(deptIds)) as number[];

    if (uniqueDeptIds.length > 0) {
      const deptUrl = `${this.API_BASE}/items/department?filter[department_id][_in]=${uniqueDeptIds.join(",")}&fields=department_id,department_name`;
      try {
        const deptRes = await fetch(deptUrl, { headers: this.getHeaders() });
        if (deptRes.ok) {
          const { data: deptData } = await deptRes.json();
          const deptMap = new Map();
          if (Array.isArray(deptData)) {
            deptData.forEach((d) => deptMap.set(d.department_id, d.department_name));
          }

          enriched = enriched.map((item) => {
            const u = item.user_id as UserDetails | null;
            const uDept = u?.user_department;
            const dId = typeof uDept === "number" ? uDept : (uDept as unknown as { id: number })?.id;
            
            if (dId && deptMap.has(dId)) {
              const deptName = deptMap.get(dId);
              // Inject into user object
              if (typeof item.user_id === "object" && item.user_id !== null) {
                (item.user_id as UserDetails).user_department = { department_name: deptName };
              }
              return { ...item, department_name: deptName }; // For backward compatibility in code
            }
            return item;
          });
        }
      } catch (err) {
        console.error("[TAService] Failed to bulk fetch departments:", err);
      }
    }

    return enriched;
  }

  // ─── My Submissions ─────────────────────────────────────────────────────────

  /**
   * Fetches all requests filed by a specific user across all 3 modules with filtering.
   */
  static async fetchMyRequests(
    userId: number,
    filters?: TAFilterOptions
  ): Promise<AnyTARequest[]> {
    const types: RequestType[] =
      filters?.types && filters.types.length > 0
        ? filters.types
        : ["leave", "overtime", "undertime"];

    const results: AnyTARequest[] = [];

    for (const type of types) {
      const collection = this.getCollection(type);
      let url =
        `${this.API_BASE}/items/${collection}` +
        `?filter[user_id][_eq]=${userId}&fields=*,user_id.*,approver_id.*`;

      if (filters?.status && filters.status !== "all") {
        url += `&filter[status][_eq]=${filters.status}`;
      }
      if (filters?.startDate) url += `&filter[filed_at][_gte]=${filters.startDate}`;
      if (filters?.endDate)   url += `&filter[filed_at][_lte]=${filters.endDate}`;

      const res = await fetch(url, { headers: this.getHeaders() });


      if (!res.ok) continue;
      const { data } = await res.json();
      if (!Array.isArray(data) || data.length === 0) continue;

      const enhanced = await Promise.all(
        data.map(async (item: Record<string, unknown>) => {
          const deptId =
            typeof item.department_id === "object"
              ? (item.department_id as { id: number })?.id
              : item.department_id;
          const totalLevels = await this.fetchTotalLevels(deptId as number);
          return { ...item, module_type: type, total_levels: totalLevels };
        })
      );

      results.push(...enhanced as AnyTARequest[]);
    }

    return results.sort(
      (a, b) =>
        new Date(b.filed_at).getTime() - new Date(a.filed_at).getTime()
    );
  }

  // ─── Audit History ──────────────────────────────────────────────────────────

  /**
   * Fetches the detailed audit history for a specific request.
   */
  static async fetchDetailedHistory(
    requestId: number,
    type: RequestType
  ): Promise<HistoryLog[]> {
    const url =
      `${this.API_BASE}/items/ta_approval_history` +
      `?filter[request_id][_eq]=${requestId}` +
      `&filter[request_type][_eq]=${type}` +
      `&fields=history_id,request_id,request_type,approver_id,status_after,remarks,created_at` +
      `&sort=created_at`;

    const res = await fetch(url, { headers: this.getHeaders() });
    if (!res.ok) return [];
    const { data } = await res.json();
    if (!Array.isArray(data) || data.length === 0) return [];

    // Resolve approver names manually since approver_id is an INT
    const approverIds = data.map(log => Number(log.approver_id)).filter(id => !!id);
    const uniqueIds = Array.from(new Set(approverIds));
    const userMap = new Map<number, UserDetails>();

    if (uniqueIds.length > 0) {
      const userUrl = `${this.API_BASE}/items/user?filter[user_id][_in]=${uniqueIds.join(",")}&fields=user_id,user_fname,user_lname,user_position,user_department.department_name`;
      try {
        const uRes = await fetch(userUrl, { headers: this.getHeaders() });
        if (uRes.ok) {
          const { data: users } = await uRes.json();
          if (Array.isArray(users)) {
            users.forEach(u => userMap.set(Number(u.user_id), u));
          }
        }
      } catch (e) {
        console.error("[TAService] History user fetch failed:", e);
      }
    }

    return data.map(log => ({
      ...log,
      approver_id: userMap.get(Number(log.approver_id)) || { user_fname: "System", user_lname: "", user_position: "VOS" }
    })) as HistoryLog[];
  }

  /**
   * Fetches approval action logs.
   * For HR Head (isHRHead=true): returns ALL logs globally.
   * For regular approvers: returns logs where they were the acting approver.
   */
  static async fetchApproverLogs(
    approverId: number, 
    limit = 100, 
    isHRHead = false,
    filters?: TAFilterOptions
  ): Promise<ApprovalLogEntry[]> {
    // We fetch a larger pool of logs and filter by department/cutoff in memory
    // because history entries are polymorphic and we need to check the request's actual date.
    const assignments = !isHRHead ? await this.fetchApproverAssignments(approverId) : [];
    const assignedDeptIds = assignments.map(a => Number(a.department_id));

    const search = new URLSearchParams();
    search.set("fields", "history_id,request_id,request_type,status_after,remarks,created_at,approver_id");
    search.set("sort[]", "-created_at");
    
    // Fetch a larger set to ensure we find enough matches after request-date filtering
    const fetchLimit = filters?.startDate ? 500 : limit;
    search.set("limit", String(fetchLimit));

    const url = `${this.API_BASE}/items/ta_approval_history?${search.toString()}`;

    const res = await fetch(url, { headers: this.getHeaders() });
    if (!res.ok) {
      console.error("[TAService] Failed to fetch approver logs:", res.status);
      return [];
    }
    const { data } = await res.json();
    if (!Array.isArray(data) || data.length === 0) return [];

    // Enrich each log entry with requester info by fetching the actual request
    const enriched = await Promise.all(
      data.map(async (log: Record<string, unknown>) => {
        try {
          const rType = log.request_type as RequestType;
          const collection = this.getCollection(rType);

          const reqRes = await fetch(
            `${this.API_BASE}/items/${collection}/${log.request_id}` +
            `?fields=*,user_id.user_id,user_id.user_fname,user_id.user_lname,user_id.user_position,user_id.user_department.department_name`,
            { headers: this.getHeaders() }
          );
          if (!reqRes.ok) return { ...log, requester: null, current_status: null, request_details: null };
          const { data: req } = await reqRes.json();
          // temporarily assign raw user_id to requester, we will map it next
          const r = req as Record<string, unknown>;
          return { ...log, requester: r?.user_id ?? null, current_status: r?.status ?? null, request_details: req };
        } catch {
          return { ...log, requester: null, current_status: null, request_details: null };
        }
      })
    );

    // ── Bulk fetch user details (for Requesters and Approvers) ──
    const userIdsSet = new Set<number>();
    enriched.forEach((item) => {
      const log = item as Record<string, unknown>;
      // requester
      const r = log.requester as UserDetails | number | null;
      const rid = typeof r === "number" ? r : (r as UserDetails | null)?.user_id;
      if (rid) userIdsSet.add(rid);
      // approver
      const a = log.approver_id as UserDetails | number | null;
      const aid = typeof a === "number" ? a : (a as UserDetails | null)?.user_id;
      if (aid) userIdsSet.add(aid);
    });

    const uniqueUserIds = Array.from(userIdsSet);
    const userMap = new Map<number, UserDetails>();

    if (uniqueUserIds.length > 0) {
      const userUrl = `${this.API_BASE}/items/user?filter[user_id][_in]=${uniqueUserIds.join(",")}&fields=user_id,user_fname,user_lname,user_position,user_department`;
      try {
        const userRes = await fetch(userUrl, { headers: this.getHeaders() });
        if (userRes.ok) {
          const { data: userData } = await userRes.json();
          if (Array.isArray(userData)) {
            userData.forEach((u: UserDetails) => {
              const uid = Number(u.user_id);
              if (uid) userMap.set(uid, u);
            });
          }
        }
      } catch (err) {
        console.error("[TAService] Failed to bulk fetch users for logs:", err);
      }
    }

    // ── Bulk fetch department names for logs (BASED ON USER TABLE) ──
    const deptIdsSet = new Set<number>();
    userMap.forEach((u) => {
      const uDept = u.user_department;
      const dId = typeof uDept === "number" ? uDept : (uDept as unknown as { id: number })?.id;
      if (dId) deptIdsSet.add(Number(dId));
    });

    const uniqueDeptIds = Array.from(deptIdsSet);
    const deptMap = new Map();
    if (uniqueDeptIds.length > 0) {
      const deptUrl = `${this.API_BASE}/items/department?filter[department_id][_in]=${uniqueDeptIds.join(",")}&fields=department_id,department_name`;
      try {
        const deptRes = await fetch(deptUrl, { headers: this.getHeaders() });
        if (deptRes.ok) {
          const { data: deptData } = await deptRes.json();
          if (Array.isArray(deptData)) {
            deptData.forEach((d) => deptMap.set(d.department_id, d.department_name));
          }
        }
      } catch (err) {
        console.error("[TAService] Failed to bulk fetch departments for logs:", err);
      }
    }

    // In-memory filter for Cutoff (Request Date) & Department
    const filtered = enriched.filter(item => {
      const logItem = item as Record<string, unknown>;
      const details = logItem.request_details as Record<string, unknown> | null;
      if (!details) return false;

      // 1. Cutoff Filter
      if (filters?.startDate || filters?.endDate) {
        const rType = logItem.request_type as string;
        let refDate = details.filed_at as string;
        if (rType === 'leave') refDate = (details.leave_start as string) || refDate;
        else if (rType === 'overtime' || rType === 'undertime') refDate = (details.request_date as string) || refDate;

        if (refDate) {
          if (filters.startDate && refDate < filters.startDate) return false;
          if (filters.endDate && refDate > filters.endDate) return false;
        }
      }

      // 2. Department Filter
      if (filters?.departmentId) {
        const deptId = details.department_id;
        const normalizedDeptId = typeof deptId === 'object' ? Number((deptId as Record<string, unknown>)?.id) : Number(deptId);
        if (normalizedDeptId !== filters.departmentId) return false;
      }

      // 3. Authorization Check
      if (isHRHead) return true;
      const actId = Number(typeof logItem.approver_id === 'object' ? (logItem.approver_id as UserDetails)?.user_id : logItem.approver_id);
      if (actId === approverId) return true;

      const deptId = details.department_id;
      const normalizedDeptId = typeof deptId === 'object' ? Number((deptId as Record<string, unknown>)?.id) : Number(deptId);
      return assignedDeptIds.includes(normalizedDeptId);
    });

    // Final mapping and limiting to output size
    const mapped = filtered.map((item) => {
      const log = item as Record<string, unknown>;
      
      // requester
      const r = log.requester;
      const rid = r ? (typeof r === "number" ? r : (r as UserDetails).user_id) : null;
      const requester = rid && userMap.has(Number(rid)) ? JSON.parse(JSON.stringify(userMap.get(Number(rid)))) : r;

      // approver 
      const a = log.approver_id;
      const aid = a ? (typeof a === "number" ? a : (a as UserDetails).user_id) : null;
      const approver = aid && userMap.has(Number(aid)) ? userMap.get(Number(aid)) : a;

      // Inject department name into requester if available
      const ur = requester as UserDetails | null;
      const uDept = ur?.user_department;
      const dId = typeof uDept === "number" ? uDept : (uDept as unknown as { id: number })?.id;
      const deptName = dId ? deptMap.get(Number(dId)) : "";
      
      if (ur && typeof ur === 'object' && deptName) {
        ur.user_department = { department_name: deptName };
      }

      return { ...log, requester, approver_id: approver };
    }) as ApprovalLogEntry[];

    return mapped.slice(0, limit);
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────

  /**
   * Returns all active (department_id, level) assignments for the given approver.
   */
  private static async fetchApproverAssignments(
    approverId: number
  ): Promise<ApproverAssignment[]> {
    const url =
      `${this.API_BASE}/items/ta_draft_approvers` +
      `?filter[approver_id][_eq]=${approverId}` +
      `&filter[is_deleted][_eq]=0` +
      `&fields=department_id,level`;

    const res = await fetch(url, { headers: this.getHeaders() });
    if (!res.ok) {
      console.error("[TAService] Failed to fetch approver assignments:", res.status);
      return [];
    }
    const { data } = await res.json();
    if (!Array.isArray(data)) return [];

    return data.map((a: Record<string, unknown>) => ({
      department_id: typeof a.department_id === "object" ? Number((a.department_id as Record<string, unknown>)?.id) : Number(a.department_id),
      level: Number(a.level)
    }));
  }

  /**
   * Returns the total number of active approval levels for a given department.
   * Falls back to 1 when the department has no configured approvers.
   */
  static async fetchTotalLevels(departmentId: number | null): Promise<number> {
    if (!departmentId) return 1;
    const url =
      `${this.API_BASE}/items/ta_draft_approvers` +
      `?filter[department_id][_eq]=${departmentId}` +
      `&filter[is_deleted][_eq]=0` +
      `&aggregate[max]=level`;

    const res = await fetch(url, { headers: this.getHeaders() });
    if (!res.ok) return 1;
    const { data } = await res.json();
    const maxLevel = Number(data[0]?.max?.level ?? 0);
    return maxLevel > 0 ? maxLevel : 1;
  }

  /**
   * Verifies if a user is the Department Head of the "Human Resource" department.
   */
  static async isHRDepartmentHead(userId: number): Promise<boolean> {
    const url = `${this.API_BASE}/items/department?filter[department_name][_eq]=Human Resource&fields=department_head_id`;
    try {
      const res = await fetch(url, { headers: this.getHeaders() });
      if (!res.ok) return false;
      const { data } = await res.json();
      if (!Array.isArray(data) || data.length === 0) return false;
      
      // Handle the case where department_head_id might be a numeric string or object
      const headId = typeof data[0].department_head_id === 'object' 
        ? data[0].department_head_id?.user_id 
        : Number(data[0].department_head_id);
        
      return headId === userId;
    } catch (err) {
      console.error("[TAService] Error checking HR head status:", err);
      return false;
    }
  }

  // ─── Action Processing ──────────────────────────────────────────────────────

  /**
   * Core Approval Logic — Approve / Reject / Return.
   */
  static async processAction(
    payload: TAActionPayload,
    currentApproverId: number
  ) {
    const { requestId, type, action, remarks } = payload;
    const collection = this.getCollection(type);

    // 1. Fetch current request state
    const reqUrl = `${this.API_BASE}/items/${collection}/${requestId}`;
    const reqRes = await fetch(reqUrl, { headers: this.getHeaders() });
    if (!reqRes.ok) throw new Error("Request not found");
    const { data: request } = await reqRes.json();

    if (request.status !== "pending") {
      throw new Error(
        `This request has already been ${request.status} and is now read-only.`
      );
    }

    // Authorization check
    const assignments = await this.fetchApproverAssignments(currentApproverId);
    const isAssigned = assignments.some(
      (a) =>
        a.department_id === request.department_id &&
        a.level === request.current_approval_level
    );

    const isOverrideAction = ["override", "approve_override", "reject_override"].includes(action);
    if (!isAssigned && !isOverrideAction) {
      throw new Error("Unauthorized: you are not the assigned approver for this request at its current level.");
    }

    let nextStatus = request.status as string;
    let nextLevel = request.current_approval_level as number;
    let nextApproverId: number | null = currentApproverId;
    let approvedAt: string | null = null;
    const now = new Date();
    // Add 8 hours for Philippine Time (UTC+8)
    const phtDate = new Date(now.getTime() + (8 * 60 * 60 * 1000));
    const phtTimestamp = phtDate.toISOString().slice(0, 19).replace("T", " ");

    if (action === "approve") {
      // Look for a next-level approver in the same department
      const nextLevelNum = request.current_approval_level + 1;
      const approverUrl =
        `${this.API_BASE}/items/ta_draft_approvers` +
        `?filter[department_id][_eq]=${request.department_id}` +
        `&filter[level][_eq]=${nextLevelNum}` +
        `&filter[is_deleted][_eq]=0`;

      const appRes = await fetch(approverUrl, { headers: this.getHeaders() });
      const { data: approvers } = await appRes.json();

      if (approvers && approvers.length > 0) {
        // Hand off to next level
        nextLevel = nextLevelNum;
        nextApproverId = approvers[0].approver_id;
        nextStatus = "pending";
      } else {
        // No more levels → final approval
        nextStatus = "approved";
        nextApproverId = currentApproverId;
        approvedAt = phtTimestamp;
      }
    } else if (action === "reject") {
      nextStatus = "rejected";
    } else if (action === "return") {
      // Reset to level 1 so the employee can revise and resubmit
      nextStatus = "pending";
      nextLevel = 1;
      const l1Url =
        `${this.API_BASE}/items/ta_draft_approvers` +
        `?filter[department_id][_eq]=${request.department_id}` +
        `&filter[level][_eq]=1` +
        `&filter[is_deleted][_eq]=0`;
      const l1Res = await fetch(l1Url, { headers: this.getHeaders() });
      const { data: l1Apps } = await l1Res.json();
      nextApproverId =
        l1Apps && l1Apps.length > 0 ? l1Apps[0].approver_id : null;
    } else if (action === "override" || action === "approve_override" || action === "reject_override") {
      const isHRHead = await this.isHRDepartmentHead(currentApproverId);
      if (!isHRHead) {
        throw new Error("Unauthorized: Only the HR Department Head can perform an override.");
      }
      if (request.current_approval_level <= 1) {
        throw new Error("Unauthorized: Override is only allowed after Level 1 has been reviewed and approved.");
      }
      if (!payload.attachment_uuid) {
        throw new Error("Override requires an attachment for proof of permission.");
      }

      if (action === "reject_override") {
        nextStatus = "rejected";
      } else {
        // override or approve_override
        nextStatus = "approved";
        approvedAt = phtTimestamp;
      }
      nextApproverId = currentApproverId;
    }

    // 2. Persist state change
    const updatePayload: Record<string, unknown> = {
      status: nextStatus,
      current_approval_level: nextLevel,
      approver_id: nextApproverId,
      remarks: ["override", "approve_override", "reject_override"].includes(action)
        ? `[OVERRIDE BY HR] ${remarks || request.remarks}` 
        : (remarks || request.remarks),
    };
    if (approvedAt) updatePayload.approved_at = approvedAt;

    if (["override", "approve_override", "reject_override"].includes(action) && payload.attachment_uuid) {
      if (type === "leave") {
        updatePayload.attatchment_uuid = payload.attachment_uuid;
      } else {
        updatePayload.attachment_uuid = payload.attachment_uuid;
      }
    }

    const patchRes = await fetch(reqUrl, {
      method: "PATCH",
      headers: this.getHeaders(),
      body: JSON.stringify(updatePayload),
    });

    if (!patchRes.ok) throw new Error("Failed to update request state");

    // 3. Create Audit History entry
    // Use the action to determine logical status for log if it differs from request status
    let statusForLog = nextStatus;
    if (action === "return") statusForLog = "returned";

    await fetch(`${this.API_BASE}/items/ta_approval_history`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify({
        request_id: requestId,
        request_type: type,
        approver_id: currentApproverId,
        status_after: statusForLog,
        remarks: remarks,
        created_at: phtTimestamp,
      }),
    });

    return { success: true, status: nextStatus, level: nextLevel };
  }
}
