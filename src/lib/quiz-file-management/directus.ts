// Shared Directus access for the Quiz File Management server routes.
//
// Every quiz route used to carry its own copy of this exact helper. The
// quiz-attempt routes and other quiz-file-management server code now share this
// one implementation so the request/parse/error behaviour can't drift.

export const DIRECTUS_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

const STATIC_TOKEN = process.env.DIRECTUS_STATIC_TOKEN;

/**
 * Calls the Directus items API with the shared static token.
 *
 * On a non-2xx response it logs the body and returns Directus's parsed error
 * envelope (so callers can inspect `.error`); if the body isn't JSON it throws.
 * A 204 returns null. This matches the behaviour the quiz routes have always
 * relied on.
 */
export async function dFetch(path: string, options?: RequestInit) {
    const res = await fetch(`${DIRECTUS_URL}${path}`, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${STATIC_TOKEN}`,
            ...(options?.headers || {}),
        },
    });

    if (!res.ok) {
        const text = await res.text();
        console.error("DIRECTUS ERROR:", text);
        try {
            return JSON.parse(text);
        } catch {
            throw new Error(text);
        }
    }

    if (res.status === 204) {
        return null;
    }

    return res.json();
}

/** Turns a Directus file UUID into a fully-qualified `/assets/<uuid>` URL, or null. */
export function toAssetUrl(fileId: string | null | undefined): string | null {
    if (!fileId) return null;
    return `${DIRECTUS_URL}/assets/${fileId}`;
}
