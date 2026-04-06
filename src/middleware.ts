// src/middleware.ts
import { NextRequest, NextResponse } from "next/server"

const COOKIE_NAME = "vos_access_token"
const PROTECTED_PREFIXES = ["/dashboard", "/scm", "/fm", "/hrm", "/bia", "/arf", "/cafeteria"]
const PUBLIC_FILE = /\.(.*)$/

function isProtectedPath(pathname: string) {
    return PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}

function decodeJwt(token: string): Record<string, unknown> | null {
    try {
        const parts = token.split(".");
        if (parts.length < 2) return null;
        let s = parts[1].replace(/-/g, "+").replace(/_/g, "/");
        while (s.length % 4) s += "=";
        const json = Buffer.from(s, "base64").toString("utf8");
        return JSON.parse(json);
    } catch {
        return null;
    }
}

export async function middleware(req: NextRequest) {
    if (process.env.NEXT_PUBLIC_AUTH_DISABLED === "true") {
        return NextResponse.next()
    }

    const { pathname } = req.nextUrl

    if (
        pathname.startsWith("/_next") ||
        pathname.startsWith("/favicon.ico") ||
        pathname.startsWith("/robots.txt") ||
        pathname.startsWith("/sitemap.xml") ||
        PUBLIC_FILE.test(pathname)
    ) {
        return NextResponse.next()
    }

    if (
        pathname === "/login" ||
        pathname.startsWith("/api/auth/login") ||
        pathname.startsWith("/api/auth/logout")
    ) {
        return NextResponse.next()
    }

    if (!isProtectedPath(pathname)) {
        return NextResponse.next()
    }

    const token = req.cookies.get(COOKIE_NAME)?.value
    if (!token) {
        const url = req.nextUrl.clone()
        url.pathname = "/login"
        url.searchParams.set("next", pathname)
        return NextResponse.redirect(url)
    }

    // --- Subsystem Authorization ---
    const payload = decodeJwt(token);
    
    // Map path to subsystem ID and specific module slug
    const subsystemMatch = PROTECTED_PREFIXES.find((p) => pathname.startsWith(p));
    if (subsystemMatch) {
        const subsystemId = subsystemMatch.replace("/", "");
        
        // Dashboard is always allowed if logged in
        if (subsystemId === "dashboard" || subsystemId === "main-dashboard") {
            return NextResponse.next();
        }

        let authorizedSubsystemPaths: string[] = [];
        let authorizedModulePaths: string[] = [];
        let allModulePaths: string[] = [];
        
        const directusBase = process.env.NEXT_PUBLIC_API_BASE_URL;
        const directusToken = process.env.DIRECTUS_STATIC_TOKEN;

        if (directusBase && directusToken && payload && payload.sub) {
            const filter = JSON.stringify({ user_id: { _eq: payload.sub } });
            try {
                // Fetch LIVE permissions from junction tables using EXACT base_path and bypass cache
                const [subRes, modRes, allModsRes] = await Promise.all([
                    fetch(`${directusBase}/items/user_access_subsystems?filter=${encodeURIComponent(filter)}&limit=-1&fields=subsystem_id.base_path`, {
                        headers: { "Authorization": `Bearer ${directusToken}` },
                        cache: 'no-store'
                    }),
                    fetch(`${directusBase}/items/user_access_modules?filter=${encodeURIComponent(filter)}&limit=-1&fields=module_id.base_path`, {
                        headers: { "Authorization": `Bearer ${directusToken}` },
                        cache: 'no-store'
                    }),
                    fetch(`${directusBase}/items/modules?limit=-1&fields=base_path`, {
                        headers: { "Authorization": `Bearer ${directusToken}` },
                        cache: 'no-store'
                    })
                ]);

                if (subRes.ok && modRes.ok && allModsRes.ok) {
                    const [subData, modData, allModsData] = await Promise.all([subRes.json(), modRes.json(), allModsRes.json()]);
                    authorizedSubsystemPaths = (subData.data || []).map((row: any) => row.subsystem_id?.base_path?.trim()).filter(Boolean);
                    authorizedModulePaths = (modData.data || []).map((row: any) => row.module_id?.base_path?.trim()).filter(Boolean);
                    allModulePaths = (allModsData.data || []).map((row: any) => row.base_path?.trim()).filter(Boolean);
                } 
            } catch (err) {
                 console.error("[Middleware] Failed to fetch permissions from Directus:", err);
            }
        }

        // --- Stricter URL Matching Logic ---
        const cleanPathname = pathname.replace(/\/$/, "");
        let isAuthorized = false;

        // 1. Root Subsystem Match (e.g. exactly /hrm)
        if (authorizedSubsystemPaths.includes(cleanPathname)) {
            isAuthorized = true;
        }

        // 2. Exact Module Match or Sub-Route of Module
        if (!isAuthorized) {
            if (authorizedModulePaths.includes(cleanPathname)) {
                isAuthorized = true;
            } else {
                if (allModulePaths.includes(cleanPathname)) {
                    isAuthorized = false;
                } else {
                    isAuthorized = authorizedModulePaths.some(p => p !== "/" && p !== "" && cleanPathname.startsWith(p + "/"));
                }
            }
        }

        console.log("=== MIDDLEWARE DEBUG ===");
        console.log("cleanPathname:", cleanPathname);
        console.log("authorizedSubsystemPaths:", authorizedSubsystemPaths);
        console.log("authorizedModulePaths:", authorizedModulePaths);
        console.log("allModulePaths.includes(cleanPathname):", allModulePaths.includes(cleanPathname));
        console.log("isAuthorized:", isAuthorized);
        console.log("========================");

        if (!isAuthorized) {
            console.warn(`[Middleware] Unauthorized access attempt: User ${payload?.email} -> ${pathname}`);
            const url = req.nextUrl.clone();
            url.pathname = "/main-dashboard";
            url.searchParams.set("error", "unauthorized_access");
            url.searchParams.set("module", subsystemId);
            return NextResponse.redirect(url);
        }
    }

    return NextResponse.next();
}

export const config = {
    matcher: ["/:path*"],
}
