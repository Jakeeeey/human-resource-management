import { cookies } from "next/headers";

type CookieStoreLike = {
  get: (name: string) => { value?: string } | undefined;
};

async function getCookieStore(): Promise<CookieStoreLike> {
  const maybe = cookies() as unknown;
  if (maybe && typeof (maybe as Record<string, unknown>).then === "function") {
    return (await maybe) as CookieStoreLike;
  }
  return maybe as CookieStoreLike;
}

export function getDirectusBaseUrl() {
  const base =
    process.env.DIRECTUS_URL ||
    process.env.NEXT_PUBLIC_DIRECTUS_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    "";

  if (!base) throw new Error("Missing DIRECTUS_URL / NEXT_PUBLIC_DIRECTUS_URL env var.");
  return base.replace(/\/+$/, "");
}

export async function getAuthHeader(): Promise<Record<string, string>> {
  // ✅ Prefer server token if you have it
  const envToken =
    process.env.DIRECTUS_TOKEN ||
    process.env.NEXT_PUBLIC_DIRECTUS_TOKEN ||
    process.env.NEXT_PUBLIC_DIRECTUS_STATIC_TOKEN ||
    "";

  if (envToken) return { Authorization: `Bearer ${envToken}` };

  // fallback to cookie
  await getCookieStore();
  const cookieToken = '';
  return cookieToken ? { Authorization: `Bearer ${cookieToken}` } : {};
}

function mergeHeaders(base: Record<string, string>, extra?: HeadersInit): Headers {
  const h = new Headers();
  for (const [k, v] of Object.entries(base)) {
    if (v !== undefined && v !== null) h.set(k, String(v));
  }
  if (extra) {
    const eh = new Headers(extra);
    eh.forEach((value, key) => h.set(key, value));
  }
  return h;
}

/**
 * Raw fetch that ALWAYS returns status + raw text.
 * Use this when Directus returns generic errors and you need debugging.
 */
export async function directusFetchRaw(path: string, init: RequestInit = {}) {
  const base = getDirectusBaseUrl();
  const auth = await getAuthHeader();

  // Only set JSON content-type when we are actually sending JSON
  const isJsonBody =
    typeof init.body === "string" || (init.body && !(init.body instanceof FormData));

  const headers = mergeHeaders(
    {
      ...(isJsonBody ? { "Content-Type": "application/json" } : {}),
      ...auth,
    },
    init.headers,
  );

  const res = await fetch(`${base}${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });

  const text = await res.text();
  return { ok: res.ok, status: res.status, text };
}

/**
 * Default helper (kept for other routes)
 */
export async function directusFetch(path: string, init: RequestInit = {}) {
  const r = await directusFetchRaw(path, init);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let json: Record<string, any> | null = null;
  try {
    json = r.text ? JSON.parse(r.text) : null;
  } catch {
    // ignore
  }

  if (!r.ok) {
    const message =
      json?.errors?.[0]?.message ||
      json?.message ||
      json?.error ||
      r.text ||
      `Directus error (${r.status})`;
    throw new Error(message);
  }

  return json;
}
