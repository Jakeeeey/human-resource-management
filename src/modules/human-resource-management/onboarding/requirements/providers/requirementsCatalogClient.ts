import type {
  RequirementsCatalogKey,
  RequirementsListQuery,
  RequirementsReorderEntry,
} from "../types/requirements-catalog.schema";

// requirementsCatalogClient.ts — CLIENT fetch layer for the todo-13
// requirements CRUD routes. One generic client is instantiated per catalog
// slug and hits this app's own proxy at
// `/api/hrm/onboarding/requirements/<slug>` — never Directus directly (the
// static token stays server-side; the browser cookie is sent automatically).
//
// READ-ONLY BY DEFAULT: `list` is a bare GET (`cache: "no-store"`). Every
// mutation is a distinct method a caller invokes explicitly; nothing in this
// module writes on its own.

export const REQUIREMENTS_API_BASE = "/api/hrm/onboarding/requirements";

interface ErrorEnvelope {
  success?: boolean;
  message?: string;
}

interface ListEnvelope<T> extends ErrorEnvelope {
  data?: T[];
}

interface ItemEnvelope<T> extends ErrorEnvelope {
  data?: T | null;
}

/** Parses a response body, tolerating an empty/non-JSON body (never throws). */
async function readJson<T>(res: Response): Promise<T | null> {
  return (await res.json().catch(() => null)) as T | null;
}

/** GET a list envelope; a non-2xx or `success:false` throws the route message. */
async function requestList<T>(
  url: string,
  init?: RequestInit
): Promise<T[]> {
  const res = await fetch(url, init);
  const body = await readJson<ListEnvelope<T>>(res);
  if (!res.ok || !body?.success) {
    throw new Error(body?.message || "Failed to load the catalog");
  }
  return Array.isArray(body.data) ? body.data : [];
}

/** Create/update: returns the persisted row; failure throws. */
async function requestItem<T>(url: string, init: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const body = await readJson<ItemEnvelope<T>>(res);
  if (!res.ok || !body?.success) {
    throw new Error(body?.message || "Request failed");
  }
  return body.data as T;
}

/** Soft-delete: success envelope with no row to return. */
async function requestVoid(url: string, init: RequestInit): Promise<void> {
  const res = await fetch(url, init);
  const body = await readJson<ErrorEnvelope>(res);
  if (!res.ok || !body?.success) {
    throw new Error(body?.message || "Delete failed");
  }
}

function buildQuery(options?: RequirementsListQuery): string {
  const params = new URLSearchParams();
  if (options?.all === true) params.set("all", "1");
  if (options?.phase !== undefined) params.set("phase", options.phase);
  const query = params.toString();
  return query === "" ? "" : `?${query}`;
}

const JSON_HEADERS = { "Content-Type": "application/json" };

/** Generic CRUD surface for one catalog slug. */
export interface CatalogClient<T, C, U> {
  /** Read-only list GET. */
  list: (options?: RequirementsListQuery) => Promise<T[]>;
  create: (data: C) => Promise<T>;
  update: (id: number, data: U) => Promise<T>;
  /** Soft delete — the route sets `is_active=0` (no `?hard=1`). */
  softDelete: (id: number) => Promise<void>;
  /** Pinned contract: `PATCH <catalog>/reorder` with `{ order }`. */
  reorder: (order: readonly RequirementsReorderEntry[]) => Promise<T[]>;
}

/**
 * Binds the shared CRUD protocol to one `/requirements/<slug>` route segment.
 * @param slug One of the four catalog route slugs.
 * @returns The typed CRUD client for that catalog.
 */
export function createCatalogClient<T, C, U>(
  slug: RequirementsCatalogKey
): CatalogClient<T, C, U> {
  const base = `${REQUIREMENTS_API_BASE}/${slug}`;
  return {
    list: (options) => requestList<T>(`${base}${buildQuery(options)}`),
    create: (data) =>
      requestItem<T>(base, {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify(data),
      }),
    update: (id, data) =>
      requestItem<T>(`${base}/${id}`, {
        method: "PATCH",
        headers: JSON_HEADERS,
        body: JSON.stringify(data),
      }),
    softDelete: (id) => requestVoid(`${base}/${id}`, { method: "DELETE" }),
    reorder: (order) =>
      requestList<T>(`${base}/reorder`, {
        method: "PATCH",
        headers: JSON_HEADERS,
        body: JSON.stringify({ order }),
      }),
  };
}
