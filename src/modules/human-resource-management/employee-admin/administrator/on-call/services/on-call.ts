import { OnCallSchedule, EnrichedOnCallSchedule } from "../types/on-call.schema";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
const STATIC_TOKEN = process.env.DIRECTUS_STATIC_TOKEN;

const headers = {
    Authorization: `Bearer ${STATIC_TOKEN}`,
    "Content-Type": "application/json",
};

/**
 * On-Call Service
 * Handles interaction with Directus API for on-call schedules and assignments.
 */
export const onCallService = {
    /**
     * Fetches all on-call schedules with relations.
     */
    async fetchAllSchedules(filters?: { department_name?: string }): Promise<EnrichedOnCallSchedule[]> {
        try {
            let url = `${API_BASE_URL}/items/oncall_schedule?fields=*,department_id.department_id,department_id.department_name,encoder_id.user_id,encoder_id.user_fname,encoder_id.user_lname`;

            const queryParams: string[] = [];
            if (filters?.department_name && filters.department_name !== "all") {
                queryParams.push(`filter[department_id][department_name][_eq]=${filters.department_name}`);
            }

            if (queryParams.length > 0) {
                url += `&${queryParams.join("&")}`;
            }

            const response = await fetch(url, { headers });
            if (!response.ok) {
                const errorText = await response.text();
                console.error(`DIRECTUS ERROR [${url}]:`, errorText);
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const result = await response.json();
            const schedules: Record<string, unknown>[] = result.data;

            // Fetch assignments for each schedule
            const enrichedSchedules = await Promise.all(
                schedules.map(async (schedule) => {
                    const assignmentsUrl = `${API_BASE_URL}/items/oncall_list?filter[dept_sched_id][_eq]=${schedule.id}&fields=*,user_id.user_id,user_id.user_fname,user_id.user_lname,user_id.user_email`;
                    const assignmentsResponse = await fetch(assignmentsUrl, { headers });
                    if (!assignmentsResponse.ok) {
                        const errorText = await assignmentsResponse.text();
                        console.error(`DIRECTUS ERROR [${assignmentsUrl}]:`, errorText);
                        throw new Error(`HTTP error! status: ${assignmentsResponse.status}`);
                    }
                    const assignmentsResult = await assignmentsResponse.json();
                    const assignments = assignmentsResult.data;

                    const deptObj = schedule.department_id as Record<string, unknown> | null;
                    const encoderObj = schedule.encoder_id as Record<string, unknown> | null;

                    return {
                        ...schedule,
                        // Ensure IDs are strictly numbers/strings and names are strings
                        department_id: deptObj && typeof deptObj === "object" ? (deptObj.department_id || deptObj.id) : deptObj,
                        department_name: deptObj && typeof deptObj === "object" ? deptObj.department_name : "Unknown Department",
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        assigned_staff: assignments.map((a: any) => ({
                            user_id: a.user_id?.user_id || a.user_id?.id || a.user_id,
                            user_fname: a.user_id?.user_fname || "Unknown",
                            user_lname: a.user_id?.user_lname || "Staff",
                            user_email: a.user_id?.user_email,
                        })),
                        last_edited_by: encoderObj ? {
                            user_fname: encoderObj && typeof encoderObj === "object" ? encoderObj.user_fname : "System",
                            user_lname: encoderObj && typeof encoderObj === "object" ? encoderObj.user_lname : "",
                            updated_at: schedule.updated_at || schedule.created_at || null,
                        } : undefined,
                        encoder_id: encoderObj && typeof encoderObj === "object" ? (encoderObj.user_id || encoderObj.id) : encoderObj,
                    } as EnrichedOnCallSchedule;
                })
            );

            return enrichedSchedules;
        } catch (e) {
            const error = e as Error;
            console.error("Error fetching on-call schedules:", error);
            throw new Error("INTERNAL_FAIL: Failed to fetch on-call schedules");
        }
    },

    /**
     * Creates a new on-call schedule with staff assignments.
     */
    async createSchedule(schedule: OnCallSchedule, staffIds: number[]): Promise<void> {
        try {
            const response = await fetch(`${API_BASE_URL}/items/oncall_schedule`, {
                method: "POST",
                headers,
                body: JSON.stringify(schedule),
            });
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const result = await response.json();
            const newScheduleId = result.data.id;

            // Create assignments
            await Promise.all(
                staffIds.map((userId) =>
                    fetch(`${API_BASE_URL}/items/oncall_list`, {
                        method: "POST",
                        headers,
                        body: JSON.stringify({ dept_sched_id: newScheduleId, user_id: userId }),
                    })
                )
            );
        } catch (e) {
            const error = e as Error;
            console.error("Error creating on-call schedule:", error);
            throw new Error("VALIDATION_FAILED: Failed to create on-call schedule");
        }
    },

    /**
     * Updates an existing on-call schedule and its assignments.
     */
    async updateSchedule(id: number, schedule: Partial<OnCallSchedule>, staffIds: number[]): Promise<void> {
        try {
            // Remove fields that should not be updated or might cause 403
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { id: _id, created_at: _ca, ...dataToUpdate } = schedule as Record<string, unknown>;

            const response = await fetch(`${API_BASE_URL}/items/oncall_schedule/${id}`, {
                method: "PATCH",
                headers,
                body: JSON.stringify(dataToUpdate),
            });

            if (!response.ok) {
                const errorBody = await response.json().catch(() => ({}));
                console.error("Directus PATCH Error:", errorBody);
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            // Clear existing assignments and recreate them
            const currentRes = await fetch(`${API_BASE_URL}/items/oncall_list?filter[dept_sched_id][_eq]=${id}`, { headers });
            if (!currentRes.ok) throw new Error(`HTTP error! status: ${currentRes.status}`);
            const currentResult = await currentRes.json();
            const currentIds = currentResult.data.map((a: { id: number }) => a.id);

            await Promise.all(currentIds.map((aid: number) =>
                fetch(`${API_BASE_URL}/items/oncall_list/${aid}`, { method: "DELETE", headers })
            ));

            await Promise.all(
                staffIds.map((userId) =>
                    fetch(`${API_BASE_URL}/items/oncall_list`, {
                        method: "POST",
                        headers,
                        body: JSON.stringify({ dept_sched_id: id, user_id: userId }),
                    })
                )
            );
        } catch (e) {
            const error = e as Error;
            console.error("Error updating on-call schedule:", error);
            throw new Error(error.message?.includes("HTTP error") ? error.message : "VALIDATION_FAILED: Failed to update on-call schedule");
        }
    },

    /**
     * Deletes an on-call schedule and its assignments.
     */
    async deleteSchedule(id: number): Promise<void> {
        try {
            const currentRes = await fetch(`${API_BASE_URL}/items/oncall_list?filter[dept_sched_id][_eq]=${id}`, { headers });
            if (!currentRes.ok) throw new Error(`HTTP error! status: ${currentRes.status}`);
            const currentResult = await currentRes.json();
            const currentIds = currentResult.data.map((a: { id: number }) => a.id);

            await Promise.all(currentIds.map((aid: number) =>
                fetch(`${API_BASE_URL}/items/oncall_list/${aid}`, { method: "DELETE", headers })
            ));

            const response = await fetch(`${API_BASE_URL}/items/oncall_schedule/${id}`, { method: "DELETE", headers });
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        } catch (e) {
            const error = e as Error;
            console.error("Error deleting on-call schedule:", error);
            throw new Error("INTERNAL_FAIL: Failed to delete on-call schedule");
        }
    },
};
