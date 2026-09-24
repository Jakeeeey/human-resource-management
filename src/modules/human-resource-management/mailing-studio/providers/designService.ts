// Client contract for the (not-yet-existing) T4 routes under
// /api/hrm/mailing-studio/templates. Envelope mirrors the old
// src/app/api/hrm/mailing/templates/route.ts pattern (read-only reference):
//   { success: boolean, data?: T, message?: string }
// Verb contract (T4 handlers delegate straight to
// services/design-persistence-service.ts):
//   POST ""                       → save (create-or-PATCH by template_key)
//   GET  ?template_key=...        → single row (null data when absent)
//   GET  (no params)              → list, newest first
// Pure client — no dFetch/Directus here (that lives server-side in
// services/design-persistence-service.ts). Until T4 ships, these calls 404 and
// useDesignAutosave surfaces status "error". Never touches mail_outbox.

export interface DesignSavePayload {
    template_key: string;
    template_name: string;
    subject: string;
    design_json: string;
    body_html?: string | null;
    body_text?: string | null;
    is_active?: boolean;
}

export interface DesignRow {
    id?: number | string;
    template_key: string;
    template_name: string;
    subject: string;
    design_json?: string | null;
    /** Derived cache (§6.4): compiled on save from design_json, never hand-edited. */
    variables?: string[] | null;
    body_html?: string | null;
    body_text?: string | null;
    is_active?: boolean | number;
    created_at?: string | null;
    updated_at?: string | null;
}

interface DesignEnvelope<T> {
    success: boolean;
    data?: T;
    message?: string;
}

const BASE = "/api/hrm/mailing-studio/templates";

/**
 * Fetches a T4 design route and unwraps the { success, data?, message? } envelope.
 * @param path - Path appended to BASE ("" or "?template_key=...").
 * @param init - Optional RequestInit (method/body/headers).
 * @returns The envelope { data, message } — message carries export degradation
 * warnings (rotated/overlap/clipped) on saves; data is undefined when absent.
 * @throws Error on non-2xx, !success, or a non-JSON body.
 */
async function request<T>(
    path: string,
    init?: RequestInit,
): Promise<{ data: T | undefined; message: string | null }> {
    const res = await fetch(`${BASE}${path}`, {
        ...init,
        headers: {
            "Content-Type": "application/json",
            ...(init?.headers ?? {}),
        },
    });
    let envelope: DesignEnvelope<T> | null = null;
    try {
        envelope = (await res.json()) as DesignEnvelope<T>;
    } catch {
        envelope = null;
    }
    if (!res.ok || !envelope?.success) {
        throw new Error(envelope?.message ?? `Design request failed (HTTP ${res.status})`);
    }
    return { data: envelope.data, message: envelope.message ?? null };
}

/**
 * Saves a design (server upserts by template_key via design-persistence-service).
 * @param payload - Template meta + stringified design_json.
 * @returns The verified row plus the envelope message (export warnings, if any).
 * @throws Error when the route rejects or returns no data.
 */
export async function saveDesign(
    payload: DesignSavePayload,
): Promise<{ row: DesignRow; message: string | null }> {
    const { data: row, message } = await request<DesignRow>("", {
        method: "POST",
        body: JSON.stringify(payload),
    });
    if (!row) throw new Error("Design save returned no data");
    return { row, message };
}

/**
 * Fetches one design by template_key.
 * @param template_key - Unique ms_templates key.
 * @returns The row, or null when absent.
 */
export async function getDesign(template_key: string): Promise<DesignRow | null> {
    const { data: row } = await request<DesignRow | null>(
        `?template_key=${encodeURIComponent(template_key)}`
    );
    return row ?? null;
}

/**
 * Lists all designs, newest first.
 * @returns Row array (empty when the route returns no data).
 */
export async function listDesigns(): Promise<DesignRow[]> {
    const { data: rows } = await request<DesignRow[]>(``);
    return rows ?? [];
}

export interface PreviewResult {
    html: string;
    warnings: string[];
}

export interface CompiledTestSendArgs {
    template_id: string | number;
    to_email: string;
    subject: string;
    body_html: string;
}

export interface CompiledTestSendResult {
    ok: boolean;
    status?: string;
    reason?: string;
}

/**
 * Sends the LIVE compiled output through the existing dry-run dispatch path
 * without persisting anything. Compiled HTML travels as send-only overrides
 * (manual-send never writes subject/body_html back to the template); the row
 * lands as `dry_run` while MAIL_DRY_RUN governs (default true), so the
 * designer can never emit real email. Template identity comes from a
 * read-only getDesign — callers must NOT save to obtain it.
 * @param args - Saved template id + recipient + live subject/compiled HTML.
 * @returns The dispatch outcome ({ ok, status?, reason? }).
 * @throws Error when the route rejects or returns no data.
 */
export async function sendCompiledTest(
    args: CompiledTestSendArgs,
): Promise<CompiledTestSendResult> {
    const res = await fetch("/api/hrm/mailing-studio/manual-send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            template_id: args.template_id,
            to_email: args.to_email,
            subject: args.subject,
            body_html: args.body_html,
        }),
    });
    let envelope: {
        success: boolean;
        data?: CompiledTestSendResult;
        message?: string;
    } | null = null;
    try {
        envelope = (await res.json()) as {
            success: boolean;
            data?: CompiledTestSendResult;
            message?: string;
        };
    } catch {
        envelope = null;
    }
    if (!res.ok || !envelope?.success || !envelope.data) {
        throw new Error(envelope?.message ?? `Test send failed (HTTP ${res.status})`);
    }
    return envelope.data;
}
/**
 * Compiles the live (possibly unsaved) canvas doc through the real export
 * path without persisting anything.
 * @param design_json - Stringified canvas doc from the live store.
 * @param subject - Becomes the export document title.
 * @returns Compiled receiver HTML + export warnings.
 * @throws Error when the route rejects (e.g. empty canvas).
 */
export async function previewDesign(
    design_json: string,
    subject?: string,
): Promise<PreviewResult> {
    const res = await fetch("/api/hrm/mailing-studio/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ design_json, ...(subject ? { subject } : {}) }),
    });
    let envelope: { success: boolean; data?: PreviewResult; message?: string } | null =
        null;
    try {
        envelope = (await res.json()) as {
            success: boolean;
            data?: PreviewResult;
            message?: string;
        };
    } catch {
        envelope = null;
    }
    if (!res.ok || !envelope?.success || !envelope.data) {
        throw new Error(envelope?.message ?? `Preview request failed (HTTP ${res.status})`);
    }
    return envelope.data;
}

/** Email-safe upload cap (5 MiB) — enforced client-side (pre-check) and server-side. */
export const MS_IMAGE_UPLOAD_MAX = 5 * 1024 * 1024;

/** Uploadable raster types. SVG is deliberately excluded (schema rule). */
export const MS_IMAGE_UPLOAD_TYPES: readonly string[] = [
    "image/png",
    "image/jpeg",
    "image/gif",
    "image/webp",
];

/** Absolute route path for image uploads (multipart `file` field). */
export const IMAGE_UPLOADS_ENDPOINT = "/api/hrm/mailing-studio/uploads";

export interface ImageFileMeta {
    name: string;
    type: string;
    size: number;
}

export interface ImageUploadResult {
    /** Absolute Directus asset URL, already vetted by validateStoredImageUrl. */
    url: string;
}

/**
 * Validates an upload candidate before it leaves the browser (mime
 * allowlist, .svg(z) extension guard, size cap). Mirrors the server route,
 * which re-validates — never trust the client alone.
 * @param meta - File name/mime/size (plain object so the route can reuse it).
 * @returns Null when uploadable, otherwise the human-readable reject reason.
 */
export function validateImageFileMeta(meta: ImageFileMeta): string | null {
    if (/\.svgz?$/i.test(meta.name.trim())) {
        return ".svg images are not allowed";
    }
    if (meta.type === "image/svg+xml") {
        return ".svg images are not allowed";
    }
    if (!MS_IMAGE_UPLOAD_TYPES.includes(meta.type)) {
        return "Only PNG, JPEG, GIF or WebP images are allowed";
    }
    if (!Number.isFinite(meta.size) || meta.size <= 0) {
        return "File is empty";
    }
    if (meta.size > MS_IMAGE_UPLOAD_MAX) {
        return "File too large (max 5 MB)";
    }
    return null;
}

/**
 * Validates a stored image URL against the upload contract: absolute URL,
 * http(s) only (cid:/data:/relative rejected), never a .svg path. This is
 * the schema rule minus its https-only clause — the dev Directus base is
 * http-only (probed: https 000 / http 200), so a strict https gate would
 * reject every upload in this environment; an https Directus base yields
 * https URLs that satisfy the full schema rule. Hand-pasted URLs keep the
 * strict https-only validator in PropertyPanel.
 * @param value - Candidate stored URL.
 * @returns Null when storable, otherwise the human-readable reject reason.
 */
export function validateStoredImageUrl(value: string): string | null {
    const trimmed = value.trim();
    if (trimmed.length === 0) return "Image URL is required";
    let url: URL;
    try {
        url = new URL(trimmed);
    } catch {
        return "Image URL must be absolute (https://…)";
    }
    if (url.protocol === "cid:") return "cid: URLs are not allowed";
    if (url.protocol === "data:") return "data: URLs are not allowed";
    if (url.protocol !== "https:" && url.protocol !== "http:") {
        return `Only http(s) URLs are allowed (got ${url.protocol})`;
    }
    if (url.pathname.toLowerCase().endsWith(".svg")) return ".svg images are not allowed";
    return null;
}

/**
 * Uploads an image file through the uploads route and returns the vetted
 * absolute asset URL for committing to an image block's props.src.
 * @param file - User-picked file (pre-validated locally, re-validated server-side).
 * @returns The stored absolute URL.
 * @throws Error with the route's message (or the local/client URL guard reason).
 */
export async function uploadImage(file: File): Promise<ImageUploadResult> {
    const localError = validateImageFileMeta({
        name: file.name,
        type: file.type,
        size: file.size,
    });
    if (localError) throw new Error(localError);
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(IMAGE_UPLOADS_ENDPOINT, { method: "POST", body: form });
    let envelope: { success: boolean; data?: { url?: unknown }; message?: string } | null =
        null;
    try {
        envelope = (await res.json()) as {
            success: boolean;
            data?: { url?: unknown };
            message?: string;
        };
    } catch {
        envelope = null;
    }
    if (!res.ok || !envelope?.success || typeof envelope.data?.url !== "string") {
        throw new Error(envelope?.message ?? `Image upload failed (HTTP ${res.status})`);
    }
    const urlError = validateStoredImageUrl(envelope.data.url);
    if (urlError) throw new Error(urlError);
    return { url: envelope.data.url.trim() };
}
