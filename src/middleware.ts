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

export function middleware(req: NextRequest) {
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
    const authorizedSubsystems = payload?.authorized_subsystems || [];

    // Map path to subsystem ID
    const subsystemMatch = PROTECTED_PREFIXES.find((p) => pathname.startsWith(p));
    if (subsystemMatch) {
        const subsystemId = subsystemMatch.replace("/", "");
        
        // Skip dashboard which is accessible to all logged-in users
        if (subsystemId !== "dashboard" && subsystemId !== "main-dashboard") {
            if (Array.isArray(authorizedSubsystems) && !authorizedSubsystems.includes(subsystemId)) {
                const url = req.nextUrl.clone()
                url.pathname = "/main-dashboard"
                // Optional: set a search param to show an alert on the dashboard
                url.searchParams.set("error", "unauthorized_subsystem")
                url.searchParams.set("subsystem", subsystemId)
                return NextResponse.redirect(url)
            }
        }
    }

    return NextResponse.next()
}

export const config = {
    matcher: ["/:path*"],
}
