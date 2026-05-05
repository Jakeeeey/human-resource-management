// src/app/api/auth/login/route.ts
import { NextRequest, NextResponse } from "next/server";
import {
    decodeJwtPayload,
    pickTokenFromPayload,
    COOKIE_NAME,
    COOKIE_MAX_AGE_CAP,
    extractClientIp,
    resolveIpGeo
} from "@/lib/auth-utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function cookieMaxAgeFromJwt(token: string): number {
    const payload = decodeJwtPayload(token);
    const exp = Number(payload?.exp); // exp is usually seconds since epoch
    const now = Math.floor(Date.now() / 1000);

    if (Number.isFinite(exp) && exp > now + 5) {
        const delta = exp - now;
        return Math.max(60, Math.min(delta, COOKIE_MAX_AGE_CAP)); // at least 60s
    }

    return COOKIE_MAX_AGE_CAP;
}

// --- In-memory lockout tracking ---
interface LockoutInfo {
    attempts: number;
    lockedUntil: number | null;
}
const lockoutMap = new Map<string, LockoutInfo>();


function getLockoutDuration(attempts: number): number {
    if (attempts >= 7) return 30 * 60 * 1000; // 30 minutes
    if (attempts === 6) return 10 * 60 * 1000; // 10 minutes
    if (attempts === 5) return 5 * 60 * 1000;  // 5 minutes
    return 0;
}

function normalizeLoginErrorMessage(status: number): string {
    if (status === 401) return "Credentials invalid.";
    if (status === 429) return "The account has been blocked, please contact the administrator.";
    if (status >= 500) return "Server is down, please contact Administrator.";
    return `Login failed (HTTP ${status}).`;
}

async function throttle() {
    await new Promise((resolve) => setTimeout(resolve, 1500));
}

export async function POST(req: NextRequest) {
    const userAgent = req.headers.get("user-agent") || "unknown";

    const baseUrl = process.env.SPRING_API_BASE_URL;
    if (!baseUrl) {
        return NextResponse.json(
            { ok: false, message: "Server misconfigured." },
            { status: 500 }
        );
    }

    const body = await req.json().catch(() => null);

    const email = String(body?.email ?? "").trim();
    const hashPassword = String(body?.hashPassword ?? body?.password ?? "").trim();
    const remember = Boolean(body?.remember);
    let latitude = typeof body?.latitude === "number" && Number.isFinite(body.latitude) ? body.latitude : null;
    let longitude = typeof body?.longitude === "number" && Number.isFinite(body.longitude) ? body.longitude : null;

    if (!email || !hashPassword) {
        return NextResponse.json(
            { ok: false, message: 'Both "email" and "hashPassword" are required.' },
            { status: 400 }
        );
    }

    // --- Check Lockout Status ---
    const lockout = lockoutMap.get(email);
    if (lockout?.lockedUntil && lockout.lockedUntil > Date.now()) {
        return NextResponse.json({
            ok: false,
            message: "TOO_MANY_ATTEMPTS",
            lockedUntil: lockout.lockedUntil
        }, { status: 429 });
    }

    // IP Geolocation fallback
    if (latitude === null || longitude === null) {
        const clientIp = extractClientIp(req.headers);
        if (clientIp) {
            const geo = await resolveIpGeo(clientIp);
            if (geo) {
                latitude = geo.latitude;
                longitude = geo.longitude;
            }
        }
    }

    const loginUrl = `${baseUrl.replace(/\/$/, "")}/auth/login`;
    const springPayload = {
        email,
        hashPassword,
        rememberMe: remember,
        latitude: latitude ?? "",
        longitude: longitude ?? "",
    };

    let springRes: Response;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12_000);

    try {
        springRes = await fetch(loginUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
                "User-Agent": userAgent,
            },
            body: JSON.stringify(springPayload),
            signal: controller.signal,
            cache: "no-store",
        });
    } catch (err: unknown) {
        console.error("[auth/login] Upstream fetch error:", err);
        await throttle();
        return NextResponse.json(
            { ok: false, message: "Server is down, please contact Administrator." },
            { status: 502 }
        );
    } finally {
        clearTimeout(timeout);
    }

    const raw = await springRes.text();
    let data: Record<string, unknown> | string | null = null;
    try {
        data = raw ? JSON.parse(raw) : null;
    } catch {
        data = raw;
    }

    if (!springRes.ok) {
        // Narrow data to an object so property accesses are type-safe.
        // When JSON.parse fails, `data` is the raw string — treat it as an empty object.
        const d = (data !== null && typeof data === "object") ? data : {} as Record<string, unknown>;

        const m = String(d.message ?? "").toLowerCase();
        const backendAttempts =
            typeof d.attempts === "number" ? d.attempts :
                typeof d.failedAttempts === "number" ? d.failedAttempts : null;

        // 1. Check for Blocked status from backend (15+ attempts)
        if (m.includes("blocked") || m.includes("account_blocked") || (backendAttempts !== null && backendAttempts >= 15)) {
            return NextResponse.json({
                ok: false,
                message: "ACCOUNT_BLOCKED"
            }, { status: 403 });
        }

        // 2. Check for Locked status from backend (5-14 attempts)
        if (m.includes("locked") || m.includes("account_locked") || d.lockUntil || (backendAttempts !== null && backendAttempts >= 5)) {
            const duration = getLockoutDuration(backendAttempts ?? 5);
            return NextResponse.json({
                ok: false,
                message: "ACCOUNT_LOCKED",
                lockedUntil: d.lockUntil ? new Date(d.lockUntil as string).getTime() : Date.now() + duration,
                attempts: backendAttempts
            }, { status: 423 }); // 423 Locked
        }

        // 3. Handle standard failure with remaining attempts calculation
        let remainingToLock = null;
        let remainingToBlock = null;

        if (backendAttempts !== null) {
            remainingToLock = Math.max(0, 5 - backendAttempts);
            remainingToBlock = Math.max(0, 15 - backendAttempts);
        } else {
            // Fallback to local in-memory lockout tracking
            const current = lockoutMap.get(email) || { attempts: 0, lockedUntil: null };
            current.attempts += 1;
            if (current.attempts >= 5) {
                current.lockedUntil = Date.now() + getLockoutDuration(current.attempts);
            }
            lockoutMap.set(email, current);
            remainingToLock = Math.max(0, 5 - current.attempts);
        }

        const msg = normalizeLoginErrorMessage(springRes.status);

        await throttle();
        return NextResponse.json({
            ok: false,
            message: msg,
            remainingAttempts: remainingToLock, // For the "X attempts remaining" toast
            remainingUntilBlock: remainingToBlock,
            attempts: backendAttempts
        }, { status: springRes.status });
    }

    lockoutMap.delete(email);

    const dataObj = (data && typeof data === "object" && "data" in data)
        ? (data as Record<string, unknown>).data as Record<string, unknown> | string | null
        : data;
    const token = pickTokenFromPayload(dataObj);

    if (!token) {
        return NextResponse.json(
            { ok: false, message: "Login succeeded but no token was returned." },
            { status: 502 }
        );
    }

    // --- Handle Forced Password Reset ---
    if (token === "PASSWORD_RESET_REQUIRED") {
        return NextResponse.json({
            ok: false,
            message: "PASSWORD_RESET_REQUIRED"
        }, { status: 403 });
    }

    const backendExp =
        (data as Record<string, unknown>)?.rememberMeExpiration ??
        ((data as Record<string, unknown>)?.data as Record<string, unknown> | undefined)?.rememberMeExpiration;
    const cookieMaxAge = typeof backendExp === "number" ? backendExp : cookieMaxAgeFromJwt(token);

    const decoded = decodeJwtPayload(token);

    const res = NextResponse.json(
        {
            ok: true,
            user: {
                firstName: decoded?.FirstName || "",
                lastName: decoded?.LastName || "",
                email: decoded?.email || "",
                role: decoded?.role || ""
            }
        },
        { headers: { "Cache-Control": "no-store" } }
    );

    res.cookies.set({
        name: COOKIE_NAME,
        value: token,
        httpOnly: true,
        sameSite: "lax",
        secure: false,
        path: "/",
        ...(remember ? { maxAge: cookieMaxAge } : {}),
    });

    if (latitude !== null && longitude !== null) {
        res.cookies.set({
            name: "user_latitude",
            value: String(latitude),
            httpOnly: true,
            sameSite: "lax",
            secure: false,
            path: "/",
            ...(remember ? { maxAge: cookieMaxAge } : {}),
        });
        res.cookies.set({
            name: "user_longitude",
            value: String(longitude),
            httpOnly: true,
            sameSite: "lax",
            secure: false,
            path: "/",
            ...(remember ? { maxAge: cookieMaxAge } : {}),
        });
    }

    return res;
}
