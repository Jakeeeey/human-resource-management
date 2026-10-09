export const DIRECTUS_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

const STATIC_TOKEN = process.env.DIRECTUS_STATIC_TOKEN;

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

export function toAssetUrl(fileId: string | null | undefined): string | null {
    if (!fileId) return null;
    return `${DIRECTUS_URL}/assets/${fileId}`;
}
