// Mailing Studio — shared client transport for the /api/hrm/mailing-studio/*
// routes. Pure client fetch against the Next API layer (which in turn rides
// the server-side shared dFetch in shared/utils/directus). Auth travels via
// HttpOnly cookies handled by the server — this module NEVER attaches an
// Authorization header and NEVER reads tokens, so no credential can leak to
// the browser bundle. Envelope mirrors the routes: { success, data?,
// message?, errors? }.

interface MsEnvelope<T> {
    success: boolean;
    data?: T;
    message?: string;
    errors?: Record<string, string[]>;
}

/**
 * Reads a mailing-studio API response and unwraps the { success, data? }
 * envelope.
 * @param res - Fetch Response from a mailing-studio route.
 * @returns The envelope data (may be undefined for empty successes).
 * @throws Error carrying the route message on non-2xx, !success, or bad JSON.
 */
async function unwrap<T>(res: Response): Promise<T | undefined> {
    let envelope: MsEnvelope<T> | null = null;
    try {
        envelope = (await res.json()) as MsEnvelope<T>;
    } catch {
        envelope = null;
    }
    if (!res.ok || !envelope || envelope.success !== true) {
        throw new Error(envelope?.message ?? `Mailing Studio request failed (HTTP ${res.status})`);
    }
    return envelope.data;
}

/**
 * GETs a mailing-studio route and unwraps its envelope data.
 * @param path - Path under /api/hrm/mailing-studio (leading slash).
 * @returns Envelope data (undefined when the route answers an empty success).
 */
export async function msGet<T>(path: string): Promise<T | undefined> {
    const res = await fetch(`/api/hrm/mailing-studio${path}`);
    return unwrap<T>(res);
}

/**
 * POSTs JSON to a mailing-studio route and unwraps its envelope data.
 * @param path - Path under /api/hrm/mailing-studio (leading slash).
 * @param body - JSON-serializable payload (objects/arrays only where the
 * route accepts them — bindings routes reject ANY nested value with a 400).
 * @returns Envelope data (undefined when the route answers an empty success).
 */
export async function msPost<T>(path: string, body: unknown): Promise<T | undefined> {
    const res = await fetch(`/api/hrm/mailing-studio${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
    return unwrap<T>(res);
}

/**
 * PATCHes JSON to a mailing-studio route and unwraps its envelope data.
 * @param path - Path under /api/hrm/mailing-studio (leading slash).
 * @param body - Partial-row payload (flat primitives only for bindings).
 * @returns Envelope data (undefined when the route answers an empty success).
 */
export async function msPatch<T>(path: string, body: unknown): Promise<T | undefined> {
    const res = await fetch(`/api/hrm/mailing-studio${path}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
    return unwrap<T>(res);
}

/**
 * DELETEs a mailing-studio route and unwraps its envelope data.
 * @param path - Path under /api/hrm/mailing-studio (leading slash).
 * @returns Envelope data (undefined when the route answers an empty success).
 */
export async function msDelete<T>(path: string): Promise<T | undefined> {
    const res = await fetch(`/api/hrm/mailing-studio${path}`, { method: "DELETE" });
    return unwrap<T>(res);
}
