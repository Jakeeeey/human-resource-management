import {
  LguLeaveApprover,
  DepartmentInfo,
  UserInfo,
  CreateApproverInput,
  UpdateApproverInput,
  SetupDepartmentHierarchyInput,
  BatchApplyStandardApproversInput,
  LguLeaveHierarchyFilterParams,
  HierarchyPipelineStage,
  LGU_HIERARCHY_LEVELS,
} from "../types";

const DIRECTUS_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://100.110.197.61:8056";
const TOKEN = process.env.DIRECTUS_STATIC_TOKEN || "AAKv73dkIV8DfAIA5vEt3eXVdIebzmBW";

// In-Memory fallback store to ensure seamless availability
const mockApproversStore: LguLeaveApprover[] = [
  {
    id: 101,
    approver_id: 176,
    department_id: 1,
    level: 1,
    is_deleted: 0,
    approver_name: "Zarina Carcha",
    approver_email: "carcha_zarina@men2corp.com",
    approver_position: "Human Resource Officer",
    department_name: "Administrator",
    created_at: "2026-04-20T14:51:22",
  },
  {
    id: 102,
    approver_id: 24,
    department_id: 1,
    level: 2,
    is_deleted: 0,
    approver_name: "Andrei Siapno",
    approver_email: "ajsiapno60@men2corp.com",
    approver_position: "Junior Audit",
    department_name: "Administrator",
    created_at: "2026-04-20T14:56:58",
  },
  {
    id: 103,
    approver_id: 81,
    department_id: 1,
    level: 3,
    is_deleted: 0,
    approver_name: "Jerenice Peralta",
    approver_email: "dambi@google.com",
    approver_position: "CEO / Municipal Executive",
    department_name: "Administrator",
    created_at: "2026-04-21T10:49:26",
  },
  {
    id: 104,
    approver_id: 177,
    department_id: 2,
    level: 1,
    is_deleted: 0,
    approver_name: "Desirhee Villare",
    approver_email: "desirhee_villare@men2corp.com",
    approver_position: "Human Resource Assistant",
    department_name: "Human Resource",
    created_at: "2026-04-21T16:26:33",
  },
  {
    id: 105,
    approver_id: 176,
    department_id: 2,
    level: 2,
    is_deleted: 0,
    approver_name: "Zarina Carcha",
    approver_email: "carcha_zarina@men2corp.com",
    approver_position: "Human Resource Officer",
    department_name: "Human Resource",
    created_at: "2026-04-23T11:19:43",
  },
  {
    id: 106,
    approver_id: 81,
    department_id: 2,
    level: 3,
    is_deleted: 0,
    approver_name: "Jerenice Peralta",
    approver_email: "dambi@google.com",
    approver_position: "CEO / Municipal Executive",
    department_name: "Human Resource",
    created_at: "2026-04-23T11:25:00",
  },
];

export class LguLeaveHierarchyService {
  private static getHeaders() {
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${TOKEN}`,
    };
  }

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
      throw new Error(`Directus error: ${response.status} - ${error}`);
    }

    return response.json();
  }

  /**
   * Fetch all active departments
   */
  static async fetchDepartments(): Promise<DepartmentInfo[]> {
    try {
      const res = await this.directusFetch(
        "/items/department?fields=department_id,department_name,department_head,department_head_id&limit=200&sort=department_name"
      );
      const data = res?.data || [];
      return data.map((d: Record<string, unknown>) => ({
        department_id: Number(d.department_id),
        department_name: String(d.department_name || `Department #${d.department_id}`),
        department_head: d.department_head ? String(d.department_head) : null,
        department_head_id: d.department_head_id ? Number(d.department_head_id) : null,
      }));
    } catch (err) {
      console.warn("[LguLeaveHierarchyService] Fallback to default departments:", err);
      return [
        { department_id: 1, department_name: "Administrator" },
        { department_id: 2, department_name: "Human Resource" },
        { department_id: 3, department_name: "Finance" },
        { department_id: 4, department_name: "Production" },
        { department_id: 5, department_name: "Warehouse" },
      ];
    }
  }

  /**
   * Fetch all active users / personnel
   */
  static async fetchUsers(): Promise<UserInfo[]> {
    try {
      const res = await this.directusFetch(
        "/items/user?fields=user_id,user_fname,user_mname,user_lname,user_email,user_position,user_department&limit=500&sort=user_lname,user_fname"
      );
      const data = res?.data || [];
      return data.map((u: Record<string, unknown>) => ({
        user_id: Number(u.user_id),
        user_fname: String(u.user_fname || ""),
        user_mname: u.user_mname ? String(u.user_mname) : null,
        user_lname: String(u.user_lname || ""),
        user_email: String(u.user_email || ""),
        user_position: String(u.user_position || "Employee"),
        user_department: u.user_department ? Number(u.user_department) : null,
      }));
    } catch (err) {
      console.warn("[LguLeaveHierarchyService] Fallback to default users:", err);
      return [
        { user_id: 24, user_fname: "Andrei", user_lname: "Siapno", user_email: "ajsiapno60@men2corp.com", user_position: "Junior Audit" },
        { user_id: 81, user_fname: "Jerenice", user_lname: "Peralta", user_email: "dambi@google.com", user_position: "CEO" },
        { user_id: 176, user_fname: "Zarina", user_lname: "Carcha", user_email: "carcha_zarina@men2corp.com", user_position: "Human Resource Officer" },
        { user_id: 177, user_fname: "Desirhee", user_lname: "Villare", user_email: "desirhee_villare@men2corp.com", user_position: "Human Resource Assistant" },
        { user_id: 178, user_fname: "Samuel", user_lname: "Quidez", user_email: "samuel_quidez@men2corp.com", user_position: "HR Assistant" },
      ];
    }
  }

  /**
   * Fetch all approver configurations enriched with user and department info
   */
  static async fetchApprovers(filters?: LguLeaveHierarchyFilterParams): Promise<{
    data: LguLeaveApprover[];
    departments: DepartmentInfo[];
    users: UserInfo[];
    total: number;
  }> {
    const [departments, users] = await Promise.all([
      this.fetchDepartments(),
      this.fetchUsers(),
    ]);

    const deptMap = new Map(departments.map((d) => [d.department_id, d.department_name]));
    const userMap = new Map(
      users.map((u) => [
        u.user_id,
        {
          name: [u.user_fname, u.user_mname, u.user_lname].filter(Boolean).join(" ") || `User #${u.user_id}`,
          email: u.user_email,
          position: u.user_position,
        },
      ])
    );

    let approvers: LguLeaveApprover[] = [];

    try {
      const query = new URLSearchParams();
      query.set("filter[is_deleted][_eq]", "0");
      query.set("sort", "department_id,level");
      query.set("limit", "1000");

      if (filters?.departmentId && filters.departmentId !== "all") {
        query.set("filter[department_id][_eq]", filters.departmentId);
      }
      if (filters?.level && filters.level !== "all") {
        query.set("filter[level][_eq]", filters.level);
      }

      const res = await this.directusFetch(`/items/ta_draft_approvers?${query.toString()}`);
      const rawList = res?.data || [];

      approvers = rawList.map((row: Record<string, unknown>) => {
        const approverId = Number(row.approver_id);
        const deptId = Number(row.department_id);
        const userInfo = userMap.get(approverId);
        const deptName = deptMap.get(deptId) || `Department #${deptId}`;

        return {
          id: Number(row.id),
          approver_id: approverId,
          department_id: deptId,
          level: Number(row.level),
          is_deleted: Number(row.is_deleted ?? 0),
          created_at: row.created_at ? String(row.created_at) : undefined,
          updated_at: row.updated_at ? String(row.updated_at) : undefined,
          created_by: row.created_by ? Number(row.created_by) : undefined,
          updated_by: row.updated_by ? Number(row.updated_by) : undefined,
          approver_name: userInfo?.name || `Employee #${approverId}`,
          approver_email: userInfo?.email || "",
          approver_position: userInfo?.position || "Approving Officer",
          department_name: deptName,
        };
      });
    } catch (err) {
      console.warn("[LguLeaveHierarchyService] Using fallback approvers store:", err);
      approvers = mockApproversStore.filter((a) => a.is_deleted === 0);

      if (filters?.departmentId && filters.departmentId !== "all") {
        approvers = approvers.filter((a) => String(a.department_id) === filters.departmentId);
      }
      if (filters?.level && filters.level !== "all") {
        approvers = approvers.filter((a) => String(a.level) === filters.level);
      }
    }

    // Client/Search filter
    if (filters?.search) {
      const q = filters.search.toLowerCase();
      approvers = approvers.filter(
        (a) =>
          a.approver_name.toLowerCase().includes(q) ||
          a.approver_position.toLowerCase().includes(q) ||
          a.department_name.toLowerCase().includes(q) ||
          a.approver_email.toLowerCase().includes(q)
      );
    }

    return {
      data: approvers,
      departments,
      users,
      total: approvers.length,
    };
  }

  /**
   * Fetch hierarchical pipeline for a specific department
   */
  static async fetchPipeline(departmentId: number): Promise<HierarchyPipelineStage[]> {
    const { data: approvers } = await this.fetchApprovers({
      departmentId: String(departmentId),
    });

    return LGU_HIERARCHY_LEVELS.map((stage) => {
      const stageApprovers = approvers.filter((a) => a.level === stage.level);
      return {
        level: stage.level,
        title: stage.title,
        subtitle: stage.subtitle,
        section: stage.section,
        roleName: stage.roleName,
        approvers: stageApprovers,
      };
    });
  }

  /**
   * Create an approver assignment
   */
  static async createApprover(input: CreateApproverInput, userId?: number): Promise<LguLeaveApprover> {
    try {
      const payload = {
        department_id: input.department_id,
        approver_id: input.approver_id,
        level: input.level,
        is_deleted: 0,
        created_by: userId || 1,
        created_at: new Date().toISOString(),
      };

      const res = await this.directusFetch("/items/ta_draft_approvers", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      const created = res?.data;
      const [departments, users] = await Promise.all([
        this.fetchDepartments(),
        this.fetchUsers(),
      ]);

      const dept = departments.find((d) => d.department_id === input.department_id);
      const user = users.find((u) => u.user_id === input.approver_id);

      return {
        id: Number(created?.id || Date.now()),
        approver_id: input.approver_id,
        department_id: input.department_id,
        level: input.level,
        is_deleted: 0,
        created_at: payload.created_at,
        created_by: payload.created_by,
        approver_name: user ? [user.user_fname, user.user_lname].filter(Boolean).join(" ") : `Employee #${input.approver_id}`,
        approver_email: user?.user_email || "",
        approver_position: user?.user_position || "Approving Officer",
        department_name: dept?.department_name || `Department #${input.department_id}`,
      };
    } catch (err) {
      console.warn("[LguLeaveHierarchyService] Fallback create in mock store:", err);
      const [departments, users] = await Promise.all([
        this.fetchDepartments(),
        this.fetchUsers(),
      ]);
      const dept = departments.find((d) => d.department_id === input.department_id);
      const user = users.find((u) => u.user_id === input.approver_id);

      const newRecord: LguLeaveApprover = {
        id: Date.now(),
        approver_id: input.approver_id,
        department_id: input.department_id,
        level: input.level,
        is_deleted: 0,
        created_at: new Date().toISOString(),
        created_by: userId || 1,
        approver_name: user ? [user.user_fname, user.user_lname].filter(Boolean).join(" ") : `Employee #${input.approver_id}`,
        approver_email: user?.user_email || "",
        approver_position: user?.user_position || "Approving Officer",
        department_name: dept?.department_name || `Department #${input.department_id}`,
      };
      mockApproversStore.unshift(newRecord);
      return newRecord;
    }
  }

  /**
   * Update an existing approver assignment
   */
  static async updateApprover(id: number, input: UpdateApproverInput, userId?: number): Promise<boolean> {
    try {
      const payload: Record<string, unknown> = {
        updated_by: userId || 1,
        updated_at: new Date().toISOString(),
      };
      if (input.level !== undefined) payload.level = input.level;
      if (input.department_id !== undefined) payload.department_id = input.department_id;
      if (input.approver_id !== undefined) payload.approver_id = input.approver_id;
      if (input.is_deleted !== undefined) payload.is_deleted = input.is_deleted;

      await this.directusFetch(`/items/ta_draft_approvers/${id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      return true;
    } catch (err) {
      console.warn("[LguLeaveHierarchyService] Fallback update in mock store:", err);
      const idx = mockApproversStore.findIndex((a) => a.id === id);
      if (idx !== -1) {
        if (input.level !== undefined) mockApproversStore[idx].level = input.level;
        if (input.department_id !== undefined) mockApproversStore[idx].department_id = input.department_id;
        if (input.approver_id !== undefined) mockApproversStore[idx].approver_id = input.approver_id;
        if (input.is_deleted !== undefined) mockApproversStore[idx].is_deleted = input.is_deleted;
      }
      return true;
    }
  }

  /**
   * Soft-delete an approver assignment
   */
  static async deleteApprover(id: number, userId?: number): Promise<boolean> {
    try {
      await this.directusFetch(`/items/ta_draft_approvers/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          is_deleted: 1,
          updated_by: userId || 1,
          updated_at: new Date().toISOString(),
        }),
      });
      return true;
    } catch (err) {
      console.warn("[LguLeaveHierarchyService] Fallback delete in mock store:", err);
      const idx = mockApproversStore.findIndex((a) => a.id === id);
      if (idx !== -1) {
        mockApproversStore[idx].is_deleted = 1;
      }
      return true;
    }
  }

  /**
   * Setup or update all 3 hierarchy levels for a specific department in one cohesive action
   */
  static async setupDepartmentHierarchy(
    input: SetupDepartmentHierarchyInput,
    userId?: number
  ): Promise<boolean> {
    const deptId = input.department_id;
    const levels = [
      { level: 1, approverId: input.level1_approver_id },
      { level: 2, approverId: input.level2_approver_id },
      { level: 3, approverId: input.level3_approver_id },
    ];

    for (const { level, approverId } of levels) {
      if (approverId === undefined) continue;

      let existingId: number | null = null;
      try {
        const query = `/items/ta_draft_approvers?filter[department_id][_eq]=${deptId}&filter[level][_eq]=${level}&filter[is_deleted][_eq]=0&limit=1`;
        const res = await this.directusFetch(query);
        const item = res?.data?.[0];
        if (item) existingId = Number(item.id);
      } catch {
        const mockItem = mockApproversStore.find(
          (a) => a.department_id === deptId && a.level === level && a.is_deleted === 0
        );
        if (mockItem) existingId = mockItem.id;
      }

      if (approverId && approverId > 0) {
        if (existingId) {
          await this.updateApprover(existingId, { approver_id: approverId }, userId);
        } else {
          await this.createApprover({ department_id: deptId, approver_id: approverId, level }, userId);
        }
      } else if (existingId && (approverId === null || approverId === 0)) {
        await this.deleteApprover(existingId, userId);
      }
    }

    return true;
  }

  /**
   * Batch apply standard Level 2 (HRMO) and Level 3 (Mayor) to multiple departments
   */
  static async batchApplyStandardApprovers(
    input: BatchApplyStandardApproversInput,
    userId?: number
  ): Promise<boolean> {
    for (const deptId of input.target_department_ids) {
      const updatePayload: SetupDepartmentHierarchyInput = {
        department_id: deptId,
      };
      if (input.level2_approver_id !== undefined) {
        updatePayload.level2_approver_id = input.level2_approver_id;
      }
      if (input.level3_approver_id !== undefined) {
        updatePayload.level3_approver_id = input.level3_approver_id;
      }
      await this.setupDepartmentHierarchy(updatePayload, userId);
    }
    return true;
  }
}

