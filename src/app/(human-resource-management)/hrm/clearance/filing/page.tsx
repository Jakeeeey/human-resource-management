import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { NavUser } from "@/components/shared/app-sidebar/nav-user";

import { cookies } from "next/headers";

import ClearanceFilingModule from "@/modules/human-resource-management/clearance/filing";
import type { OwnRequestSummary } from "@/modules/human-resource-management/clearance/filing";
import { CLEARANCE_REQUEST_STATUSES } from "@/modules/human-resource-management/clearance/filing";
import { dFetch } from "@/modules/human-resource-management/clearance/filing/utils/directus";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COOKIE_NAME = "vos_access_token";

function decodeJwtPayload(token: string): Record<string, unknown> | null {
    try {
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

function pickString(obj: Record<string, unknown> | null, keys: string[]): string {
    for (const k of keys) {
        const v = obj?.[k];
        if (typeof v === "string" && v.trim()) return v.trim();
    }
    return "";
}

function buildHeaderUserFromToken(token: string | null | undefined) {
    const payload = token ? decodeJwtPayload(token) : null;

    const first = pickString(payload, [
        "Firstname",
        "FirstName",
        "firstName",
        "firstname",
        "first_name",
    ]);
    const last = pickString(payload, [
        "LastName",
        "Lastname",
        "lastName",
        "lastname",
        "last_name",
    ]);
    const email = pickString(payload, ["email", "Email"]);

    const name = [first, last].filter(Boolean).join(" ") || email || "User";

    return {
        name,
        email: email || "",
        avatar: "/avatars/shadcn.jpg",
    };
}

function resolveActorId(payload: Record<string, unknown> | null): number | null {
    if (!payload) return null;
    const raw = payload.id ?? payload.user_id ?? payload.sub;
    if (typeof raw === "number" && Number.isInteger(raw) && raw > 0) return raw;
    if (typeof raw === "string" && raw.trim() !== "") {
        const parsed = Number(raw);
        if (Number.isInteger(parsed) && parsed > 0) return parsed;
    }
    return null;
}

function toNullableText(value: unknown): string | null {
    return typeof value === "string" ? value : null;
}

function toSummary(row: unknown): OwnRequestSummary | null {
    if (typeof row !== "object" || row === null) return null;
    const record = row as Record<string, unknown>;
    const id = record.id;
    const resignationId = record.resignation_id;
    const status = record.status;
    if (typeof id !== "number" || !Number.isInteger(id)) return null;
    if (typeof resignationId !== "number" || !Number.isInteger(resignationId)) return null;
    if (typeof status !== "string") return null;
    if (!(CLEARANCE_REQUEST_STATUSES as readonly string[]).includes(status)) return null;
    return {
        id,
        resignation_id: resignationId,
        template_title_snapshot: toNullableText(record.template_title_snapshot),
        status: status as OwnRequestSummary["status"],
        created_at: toNullableText(record.created_at),
        confirmed_at: toNullableText(record.confirmed_at),
    };
}

async function loadOwnRequests(actorId: number): Promise<OwnRequestSummary[]> {
    const body: unknown = await dFetch(
        `/items/clearance_request?filter[user_id][_eq]=${actorId}&fields=id,resignation_id,template_title_snapshot,status,created_at,confirmed_at&sort=-id&limit=-1`
    );
    const data: unknown =
        typeof body === "object" && body !== null && "data" in body
            ? (body as { data: unknown }).data
            : null;
    if (!Array.isArray(data)) return [];
    const summaries: OwnRequestSummary[] = [];
    for (const entry of data) {
        const summary = toSummary(entry);
        if (summary) summaries.push(summary);
    }
    return summaries;
}

export default async function Page() {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value ?? null;

    const headerUser = buildHeaderUserFromToken(token);
    const actorId = resolveActorId(token ? decodeJwtPayload(token) : null);

    let requests: OwnRequestSummary[] = [];
    let loadError: string | null = null;
    if (actorId === null) {
        loadError = "You are not signed in. Please sign in again to view your clearance.";
    } else {
        try {
            requests = await loadOwnRequests(actorId);
        } catch {
            loadError = "Could not load your clearance. Please try again later.";
        }
    }

    return (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            <header className="relative z-10 flex h-14 shrink-0 items-center justify-between border-b shadow-sm bg-background sm:h-16 overflow-hidden">
                <div className="flex h-full min-w-0 items-center gap-2 px-3 sm:px-4 overflow-hidden">
                    <SidebarTrigger className="-ml-1 shrink-0" />

                    <Separator
                        orientation="vertical"
                        className="hidden sm:block mr-2 data-[orientation=vertical]:h-4 shrink-0"
                    />

                    <div className="min-w-0 overflow-hidden">
                        <Breadcrumb>
                            <BreadcrumbList className="min-w-0 overflow-hidden">
                                <BreadcrumbItem className="hidden md:block shrink-0">
                                    <BreadcrumbLink href="#">Clearance</BreadcrumbLink>
                                </BreadcrumbItem>
                                <BreadcrumbSeparator className="hidden md:block shrink-0" />
                                <BreadcrumbItem className="min-w-0 overflow-hidden">
                                    <BreadcrumbPage className="truncate max-w-[56vw] sm:max-w-[60vw] md:max-w-none">
                                        My Clearance
                                    </BreadcrumbPage>
                                </BreadcrumbItem>
                            </BreadcrumbList>
                        </Breadcrumb>
                    </div>
                </div>

                <div className="flex h-full items-center px-2 sm:px-4 shrink-0 max-w-[48vw] sm:max-w-none overflow-hidden">
                    <NavUser user={headerUser} />
                </div>
            </header>

            <main className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden p-2 sm:p-4">
                <ClearanceFilingModule requests={requests} loadError={loadError} />
            </main>
        </div>
    );
}
