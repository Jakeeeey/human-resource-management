import { API_BASE_URL } from "@/config/api";
import { getAccessToken } from "@/lib/auth/token";

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

interface RequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean>;
}

/**
 * Standard HTTP client using native fetch with Next.js support.
 * Implements token injection and standardized error handling.
 */
async function request<T>(
  method: HttpMethod,
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const { params, headers, ...rest } = options;

  // Build URL with query params
  const url = new URL(endpoint.startsWith("http") ? endpoint : `${API_BASE_URL.replace(/\/+$/, "")}/${endpoint.replace(/^\/+/, "")}`);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, String(value));
    });
  }

  // Prepare headers
  const authHeaders: Record<string, string> = {
    "Content-Type": "application/json",
  };

  const token = getAccessToken();
  if (token) {
    authHeaders["Authorization"] = `Bearer ${token}`;
  }

  const mergedHeaders = { ...authHeaders, ...headers };

  try {
    const response = await fetch(url.toString(), {
      method,
      headers: mergedHeaders,
      ...rest,
    });

    if (!response.ok) {
      if (response.status === 401 && typeof window !== "undefined") {
        window.localStorage.removeItem("vos_access_token");
        // Optional: window.location.href = "/login";
      }

      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    if (response.status === 204) return {} as T;

    return await response.json();
  } catch (error) {
    if (error instanceof Error) {
      console.error(`API Request Error [${method} ${endpoint}]:`, error.message);
    }
    throw error;
  }
}

export const http = {
  get: <T>(url: string, options?: RequestOptions) => request<T>("GET", url, options),
  post: <T>(url: string, body?: any, options?: RequestOptions) =>
    request<T>("POST", url, { ...options, body: JSON.stringify(body) }),
  put: <T>(url: string, body?: any, options?: RequestOptions) =>
    request<T>("PUT", url, { ...options, body: JSON.stringify(body) }),
  patch: <T>(url: string, body?: any, options?: RequestOptions) =>
    request<T>("PATCH", url, { ...options, body: JSON.stringify(body) }),
  delete: <T>(url: string, options?: RequestOptions) => request<T>("DELETE", url, options),
};
