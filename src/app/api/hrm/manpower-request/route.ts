import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { manpowerRequestService } from "@/modules/human-resource-management/manpower-request/services/manpowerRequest.service";
import { ManpowerRequestSchema } from "@/modules/human-resource-management/manpower-request/types";

const COOKIE_NAME = "vos_access_token";

function decodeJwtPayload(token: string): Record<string, unknown> | null {
    try {
        if (!token) return null;
        const parts = token.split(".");
        if (parts.length < 2) return null;
        const p = parts[1];
        const b64 = p.replace(/-/g, "+").replace(/_/g, "/");
        const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
        const json = Buffer.from(padded, "base64").toString("utf8");
        return JSON.parse(json);
    } catch {
        return null;
    }
}

export async function GET() {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get(COOKIE_NAME)?.value;
        const payload = token ? decodeJwtPayload(token) : null;
        const userId = payload?.id || payload?.user_id || payload?.sub;

        let currentUserDepartmentId: number | null = null;
        if (userId) {
             const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8055";
             const STATIC_TOKEN = process.env.DIRECTUS_STATIC_TOKEN;
             if (STATIC_TOKEN) {
                 try {
                     const userRes = await fetch(`${API_BASE_URL}/items/user/${userId}?fields=user_department`, {
                         headers: { "Authorization": `Bearer ${STATIC_TOKEN}` }
                     });
                     if (userRes.ok) {
                         const userData = await userRes.json();
                         if (userData?.data?.user_department) {
                             currentUserDepartmentId = typeof userData.data.user_department === 'object'
                                 ? userData.data.user_department.department_id
                                 : Number(userData.data.user_department);
                         }
                     }
                 } catch (err) {}
             }
        }

        let [data, departments, divisions, users] = await Promise.all([
            manpowerRequestService.fetchAll(),
            manpowerRequestService.fetchDepartments(),
            manpowerRequestService.fetchDivisions(),
            manpowerRequestService.fetchUsers()
        ]);
        
        if (currentUserDepartmentId) {
            data = data.filter((d: any) => d.requesting_department_id === currentUserDepartmentId);
        }

        return NextResponse.json({ data, departments, divisions, users, currentUserDepartmentId });
    } catch (e: unknown) {
        return NextResponse.json({ error: (e as Error).message }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get(COOKIE_NAME)?.value;
        const payload = token ? decodeJwtPayload(token) : null;
        const userId = payload?.id || payload?.user_id || payload?.sub;

        const body = await req.json();

        // Inject created_by and auto-fetch department
        if (userId) {
            body.requested_by = typeof userId === "string" ? parseInt(userId) : userId;

            if (!body.requesting_department_id) {
                const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8055";
                const STATIC_TOKEN = process.env.DIRECTUS_STATIC_TOKEN;
                
                if (STATIC_TOKEN) {
                    try {
                        const userRes = await fetch(`${API_BASE_URL}/items/user/${userId}?fields=user_department`, {
                            headers: { "Authorization": `Bearer ${STATIC_TOKEN}` }
                        });
                        if (userRes.ok) {
                            const userData = await userRes.json();
                            if (userData?.data?.user_department) {
                                body.requesting_department_id = typeof userData.data.user_department === 'object'
                                    ? userData.data.user_department.department_id
                                    : Number(userData.data.user_department);
                            }
                        }
                    } catch (err) {
                        console.error("Failed to fetch user department for manpower request", err);
                    }
                }
            }
        }

        const validated = ManpowerRequestSchema.parse(body);
        const data = await manpowerRequestService.create(validated);
        return NextResponse.json(data, { status: 201 });
    } catch (e: unknown) {
        console.error("Error in POST /api/hrm/manpower_request:", e);
        return NextResponse.json({ error: (e as Error).message }, { status: 400 });
    }
}
