import { cookies } from "next/headers";
import { decodeJwtPayload, COOKIE_NAME } from "@/lib/auth-utils";
import { NavItem } from "@/types/navigation";
import { z } from "zod";

/**
 * Zod Schemas derived from SQL DDL
 * Ensures strict contract between Backend and Frontend
 */

const StatusSchema = z.enum(["active", "comingSoon"]);

const DirectusModuleSchema = z.object({
    id: z.number(),
    title: z.string(),
    slug: z.string(),
    base_path: z.string().nullable(),
    icon_name: z.string().nullable().default("Folder"),
    status: StatusSchema.nullable().default("active"),
    sort: z.number().nullable(),
    parent_module_id: z.number().nullable(),
    subsystem_id: z.number().nullish(),
    subscription: z.number().nullable()
});

const SpringModuleSchema = z.object({
    userId: z.number(),
    moduleId: z.number(),
    title: z.string(),
    slug: z.string(),
    iconName: z.string().nullable().optional(),
    basePath: z.string().nullable().optional(),
    parentModuleId: z.number().nullable().optional(),
    sort: z.number().nullable().optional(),
    status: z.string().optional().default("active"), 
    subsystemSlug: z.string(),
    subscription: z.number().nullable(),
});

type DirectusModule = z.infer<typeof DirectusModuleSchema>;
type SpringModule = z.infer<typeof SpringModuleSchema>;

interface TempNavItem extends NavItem {
    moduleId: number;
    parentModuleId: number | null;
    sort?: number | null;
    iconName?: string | null;
    items: TempNavItem[];
}

/**
 * Fetches the sidebar navigation tree for a specific subsystem.
 * Uses a hybrid approach:
 * - Admin: Master List from Directus
 * - User: Authorized List from Spring Boot SQL View
 */
export async function getSidebarNavigation(subsystemSlug: string): Promise<NavItem[]> {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get(COOKIE_NAME)?.value;

        if (!token) return [];

        const payload = decodeJwtPayload(token);
        const userId = payload?.id || payload?.user_id || payload?.sub;
        const role = payload?.role;

        // Company is always fetched by hard‑coded ID = 1 (no company_id in JWT)
        let companyTier: number | null = null;
        let companySubscriptionId: number | null = null;
        const directusBase = process.env.NEXT_PUBLIC_API_BASE_URL;
        const companyFilter = encodeURIComponent(JSON.stringify({ company_id: { _eq: 1 } }));
        const companyUrl = `${directusBase?.replace(/\\+$/, "")}/items/company?filter=${companyFilter}`;
        const compRes = await fetch(companyUrl, {
            headers: { "Authorization": `Bearer ${process.env.DIRECTUS_STATIC_TOKEN}` },
            next: { revalidate: 0 }
        });
        if (compRes.ok) {
            const compJson = await compRes.json();
            const compData = compJson.data?.[0];
            companySubscriptionId = compData?.company_subscription ?? null;
        }
        // fetch company subscription tier if subscription exists
        if (companySubscriptionId) {
            const subFilter = encodeURIComponent(JSON.stringify({ id: { _eq: companySubscriptionId } }));
            const subUrl = `${directusBase?.replace(/\\+$/, "")}/items/subscription?filter=${subFilter}`;
            const subRes = await fetch(subUrl, {
                headers: { "Authorization": `Bearer ${process.env.DIRECTUS_STATIC_TOKEN}` },
                next: { revalidate: 0 }
            });
            if (subRes.ok) {
                const subJson = await subRes.json();
                const subData = subJson.data?.[0];
                companyTier = subData?.tier ?? null;
            }
        }
        if (!userId) return [];

        let modulesToProcess: TempNavItem[] = [];

        if (role === "ADMIN") {
            const directusBase = process.env.NEXT_PUBLIC_API_BASE_URL;
            const filter = encodeURIComponent(JSON.stringify({ 
                subsystem_id: { slug: { _eq: subsystemSlug } } 
            }));
            const url = `${directusBase?.replace(/\/+$/, "")}/items/modules?filter=${filter}&sort=sort&limit=-1`;
            
            const res = await fetch(url, {
                headers: { "Authorization": `Bearer ${process.env.DIRECTUS_STATIC_TOKEN}` },
                next: { revalidate: 0 } 
            });

            if (res.ok) {
                const jsonResponse = await res.json();
                const validatedData = z.array(DirectusModuleSchema).parse(jsonResponse.data || []);
                
                modulesToProcess = validatedData.map((m: DirectusModule) => ({
                    moduleId: m.id,
                    title: m.title,
                    url: m.base_path || "#",
                    slug: m.slug,
                    status: m.status || "active",
                    iconName: m.icon_name,
                    sort: m.sort,
                    parentModuleId: m.parent_module_id,
                    subscription: m.subscription ?? null,
                    items: []
                }));
            } else {
                console.error(`[Sidebar] Directus failure: ${res.status}`);
            }
        } else {
            const springBase = process.env.SPRING_API_BASE_URL;
            if (!springBase) return [];
            
            const url = `${springBase.replace(/\/+$/, "")}/api/view-user-authorized-module/all?subsystem_slug=${subsystemSlug}`;
            
            const res = await fetch(url, {
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Content-Type": "application/json"
                },
                next: { revalidate: 0 } 
            });

            if (res.ok) {
                const jsonResponse = await res.json();
                const validatedData = z.array(SpringModuleSchema).parse(jsonResponse || []);
                
                modulesToProcess = validatedData
                    .filter((m: SpringModule) => m.userId === Number(userId) && m.subsystemSlug === subsystemSlug)
                    .map((m: SpringModule) => ({
                        moduleId: m.moduleId,
                        title: m.title,
                        url: m.basePath || "#",
                        slug: m.slug,
                        status: m.status || "active",
                        iconName: m.iconName ?? null,
                        sort: m.sort ?? null,
                        parentModuleId: m.parentModuleId ?? null,
                        subscription: m.subscription ?? null,
                        items: []
                    }));
            } else {
                console.error(`[Sidebar] Spring Boot failure: ${res.status}`);
            }
        }

        if (modulesToProcess.length === 0) return [];

        const modulesById: Record<number, TempNavItem> = {};
        const roots: TempNavItem[] = [];

        modulesToProcess.forEach((m) => {
            modulesById[m.moduleId] = m;
        });

        modulesToProcess.forEach((m) => {
            if (m.parentModuleId && modulesById[m.parentModuleId]) {
                modulesById[m.parentModuleId].items.push(m);
            } else {
                roots.push(m);
            }
        });

        const sortTree = (items: TempNavItem[]): NavItem[] =>
            items
                .sort((a, b) => (a.sort || 0) - (b.sort || 0))
                .map((item) => ({
                    title: item.title,
                    url: item.url,
                    slug: item.slug,
                    status: item.status,
                    iconName: item.iconName ?? "Folder",
                    subscription: item.subscription,
                    isLocked: false,
                    items: item.items && item.items.length > 0 ? sortTree(item.items) : undefined
                }));

        const sorted = sortTree(roots);
        
        // Build a map of subscription id -> tier for modules
        const subscriptionIds = Array.from(new Set(modulesToProcess.map(m => m.subscription).filter(Boolean) as number[]));
        const subscriptionTierMap: Record<number, number> = {};
        if (subscriptionIds.length > 0) {
            const directusBase = process.env.NEXT_PUBLIC_API_BASE_URL;
            const filter = encodeURIComponent(JSON.stringify({ id: { _in: subscriptionIds } }));
            const subUrl = `${directusBase?.replace(/\\+$/,"")}/items/subscription?filter=${filter}`;
            const subRes = await fetch(subUrl, {
                headers: { "Authorization": `Bearer ${process.env.DIRECTUS_STATIC_TOKEN}` },
                next: { revalidate: 0 }
            });
            if (subRes.ok) {
                const subJson = await subRes.json();
                const subData = subJson.data || [];
                // Populate map: subscription ID → tier
                subData.forEach((s: { id: number; tier: number }) => {
                    if (s.id && typeof s.tier === "number") {
                        subscriptionTierMap[s.id] = s.tier;
                    }
                });
            }
        }

        // The lock logic below is applied for BOTH ADMIN and USER roles; no role bypass
        const applyLocks = (node: NavItem) => {
            const hasChildren = node.items && node.items.length > 0;
            if (!hasChildren) {
                const moduleTier = node.subscription ? subscriptionTierMap[node.subscription] ?? 0 : 0;
                const companyTierVal = companyTier ?? 0;
                node.isLocked = node.subscription ? moduleTier > companyTierVal : false;
            } else {
                node.items!.forEach(applyLocks);
            }
        };
        sorted.forEach(applyLocks);
        return sorted;
    } catch (err) {
        console.error("[Sidebar] Fatal Error:", err);
        return [];
    }
}
