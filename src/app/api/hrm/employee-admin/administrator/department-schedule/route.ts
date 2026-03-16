import { NextRequest, NextResponse } from "next/server";

// ============================================================================
// CONFIG
// ============================================================================

const DIRECTUS_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
if (!DIRECTUS_URL) {
    throw new Error("NEXT_PUBLIC_API_BASE_URL is not defined in environment variables");
}
const LIMIT = 1000;

const COLLECTIONS = {
    SCHEDULE: "department_schedule",
    DEPARTMENT: "department",
    USER: "user",
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

// ============================================================================
// TYPES
// ============================================================================

interface User {
    user_id: number;
    user_fname: string;
    user_lname: string;
    user_mname?: string | null;
}

interface Department {
    department_id: number;
    department_name: string;
    department_head_id: number | null;
}

interface DepartmentSchedule {
    schedule_id: number;
    department_id: number;
    working_days: number;
    work_start: string;
    work_end: string;
    lunch_start: string;
    lunch_end: string;
    break_start: string;
    break_end: string;
    workdays_note: string | null;
    grace_period: number;
    created_at: string;
    updated_at: string | null;
}

interface DirectusResponse<T> {
    data: T[];
}

// ============================================================================
// HELPERS
// ============================================================================

async function fetchAll<T>(collection: string, offset = 0, acc: T[] = []): Promise<T[]> {
    const url = `${DIRECTUS_URL}/items/${collection}?limit=${LIMIT}&offset=${offset}`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`Directus error ${collection}`);

    const json: DirectusResponse<T> = await res.json();
    const items = json.data || [];
    const all = [...acc, ...items];

    if (items.length === LIMIT) {
        return fetchAll(collection, offset + LIMIT, all);
    }

    return all;
}

async function fetchUsers(): Promise<User[]> {
    const url = `${DIRECTUS_URL}/items/${COLLECTIONS.USER}?limit=${LIMIT}&fields=user_id,user_fname,user_lname,user_mname`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return [];

    const json: DirectusResponse<User> = await res.json();
    return json.data || [];
}

// ============================================================================
// JOIN BUILDER
// ============================================================================

async function buildScheduleRelations() {
    const [schedules, departments, users] = await Promise.all([
        fetchAll<DepartmentSchedule>(COLLECTIONS.SCHEDULE),
        fetchAll<Department>(COLLECTIONS.DEPARTMENT),
        fetchUsers(),
    ]);

    const deptMap = new Map(departments.map(d => [d.department_id, d]));
    const userMap = new Map(users.map(u => [u.user_id, u]));

    const enriched = schedules.map(schedule => {
        const dept = deptMap.get(schedule.department_id);
        return {
            ...schedule,
            department: dept,
            department_head_user: dept?.department_head_id ? userMap.get(dept.department_head_id) : undefined,
        };
    });

    return { enriched, departments, users };
}

// ============================================================================
// GET - List All Schedules
// ============================================================================

export async function GET() {
    try {
        const { enriched, departments, users } = await buildScheduleRelations();

        return NextResponse.json({
            schedules: enriched,
            departments,
            users,
            metadata: {
                total: enriched.length,
                lastUpdated: new Date().toISOString(),
            },
        });
    } catch (e) {
        console.error("Department Schedule API GET error:", e);
        return NextResponse.json(
            { error: "Failed to fetch schedules" },
            { status: 500 }
        );
    }
}

// ============================================================================
// POST - Create Schedule
// ============================================================================

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();

        const scheduleData = {
            department_id: body.department_id,
            working_days: body.working_days,
            work_start: body.work_start,
            work_end: body.work_end,
            lunch_start: body.lunch_start || "12:00:00",
            lunch_end: body.lunch_end || "13:00:00",
            break_start: body.break_start || "15:00:00",
            break_end: body.break_end || "15:30:00",
            workdays_note: body.workdays_note || null,
            grace_period: body.grace_period || 5,
        };

        const res = await fetch(`${DIRECTUS_URL}/items/${COLLECTIONS.SCHEDULE}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(scheduleData),
        });

        if (!res.ok) {
            const error = await res.text();
            console.error("POST schedule error:", error);
            throw new Error(`Failed to create schedule: ${res.statusText}`);
        }

        const json = await res.json();
        return NextResponse.json(json);
    } catch (e) {
        console.error("Department Schedule API POST error:", e);
        return NextResponse.json(
            { error: "Failed to create schedule", message: e instanceof Error ? e.message : "Unknown error" },
            { status: 500 }
        );
    }
}

// ============================================================================
// PATCH - Update Schedule
// ============================================================================

export async function PATCH(req: NextRequest) {
    try {
        const body = await req.json();
        const { schedule_id, ...updateData } = body;

        if (!schedule_id) {
            return NextResponse.json(
                { error: "schedule_id is required" },
                { status: 400 }
            );
        }

        // Add updated_at timestamp
        const dataToUpdate = {
            ...updateData,
            updated_at: new Date().toISOString(),
        };

        const res = await fetch(
            `${DIRECTUS_URL}/items/${COLLECTIONS.SCHEDULE}/${schedule_id}`,
            {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(dataToUpdate),
            }
        );

        if (!res.ok) {
            const error = await res.text();
            console.error("PATCH schedule error:", error);
            throw new Error(`Failed to update schedule: ${res.statusText}`);
        }

        const json = await res.json();
        return NextResponse.json(json);
    } catch (e) {
        console.error("Department Schedule API PATCH error:", e);
        return NextResponse.json(
            { error: "Failed to update schedule", message: e instanceof Error ? e.message : "Unknown error" },
            { status: 500 }
        );
    }
}

// ============================================================================
// DELETE - Delete Schedule
// ============================================================================

export async function DELETE(req: NextRequest) {
    try {
        const id = req.nextUrl.searchParams.get("id");

        if (!id) {
            return NextResponse.json(
                { error: "Schedule ID is required" },
                { status: 400 }
            );
        }

        const res = await fetch(
            `${DIRECTUS_URL}/items/${COLLECTIONS.SCHEDULE}/${id}`,
            { method: "DELETE" }
        );

        if (!res.ok) {
            throw new Error(`Failed to delete schedule: ${res.statusText}`);
        }

        return NextResponse.json({ success: true });
    } catch (e) {
        console.error("Department Schedule API DELETE error:", e);
        return NextResponse.json(
            { error: "Failed to delete schedule", message: e instanceof Error ? e.message : "Unknown error" },
            { status: 500 }
        );
    }
}