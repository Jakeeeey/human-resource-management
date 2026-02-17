/**
 * Retrieves the access token from local storage or environment variable.
 */
export function getAccessToken(): string | null {
  // Option A (recommended): stored after login
  if (typeof window !== "undefined") {
    const t = window.localStorage.getItem("vos_access_token");
    if (t) return t;
  }

  // Option B: env token fallback (dev/service token)
  const env = process.env.DIRECTUS_STATIC_TOKEN;
  return env ?? null;
}
