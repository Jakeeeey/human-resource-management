import type {
  CreateTrainingItemInput,
  CreateTrainingTemplateInput,
  TrainingItemRow,
  TrainingTemplatesListQuery,
  TrainingTemplateRow,
  TemplateWithItems,
  UpdateTrainingItemInput,
  UpdateTrainingTemplateInput,
} from "../types/training-templates.schema";

// trainingTemplatesCatalogClient.ts — CLIENT fetch layer for the frozen
// training-templates API. Template calls hit
// `/api/hrm/onboarding/training-templates`; item calls are scoped under
// `/api/hrm/onboarding/training-templates/<templateId>/items`. This is a NEW
// client: the requirements `createCatalogClient` binds ONE flat slug and cannot
// express the template -> item nesting.
//
// READ-ONLY BY DEFAULT: every mutation is an explicit method a caller invokes;
// nothing here writes on its own. Failures arrive as
// `{ success: false, code, message }` and the route `message` is surfaced
// verbatim.

export const TRAINING_TEMPLATES_API_BASE =
  "/api/hrm/onboarding/training-templates";

interface ErrorEnvelope {
  success?: boolean;
  code?: string;
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
async function requestList<T>(url: string, init?: RequestInit): Promise<T[]> {
  const res = await fetch(url, init);
  const body = await readJson<ListEnvelope<T>>(res);
  if (!res.ok || !body?.success) {
    throw new Error(body?.message || "Failed to load training templates");
  }
  return Array.isArray(body.data) ? body.data : [];
}

/** Create/update/soft-delete: returns the persisted row; failure throws. */
async function requestItem<T>(url: string, init: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const body = await readJson<ItemEnvelope<T>>(res);
  if (!res.ok || !body?.success) {
    throw new Error(body?.message || "Request failed");
  }
  return body.data as T;
}

function buildQuery(options?: TrainingTemplatesListQuery): string {
  const params = new URLSearchParams();
  if (options?.all === true) params.set("all", "1");
  const query = params.toString();
  return query === "" ? "" : `?${query}`;
}

const JSON_HEADERS = { "Content-Type": "application/json" };

/** Item routes are always scoped to their owning template. */
function itemsBase(templateId: number): string {
  return `${TRAINING_TEMPLATES_API_BASE}/${templateId}/items`;
}

/** CRUD surface for the training-templates catalog (templates + nested items). */
export interface TrainingTemplatesClient {
  listTemplates: (
    options?: TrainingTemplatesListQuery
  ) => Promise<TemplateWithItems[]>;
  createTemplate: (
    data: CreateTrainingTemplateInput
  ) => Promise<TrainingTemplateRow>;
  updateTemplate: (
    id: number,
    data: UpdateTrainingTemplateInput
  ) => Promise<TrainingTemplateRow>;
  /** Soft delete — the route sets `is_active=0`. */
  softDeleteTemplate: (id: number) => Promise<TrainingTemplateRow>;
  listItems: (
    templateId: number,
    options?: TrainingTemplatesListQuery
  ) => Promise<TrainingItemRow[]>;
  createItem: (
    templateId: number,
    data: CreateTrainingItemInput
  ) => Promise<TrainingItemRow>;
  updateItem: (
    templateId: number,
    itemId: number,
    data: UpdateTrainingItemInput
  ) => Promise<TrainingItemRow>;
  /** Soft delete — the route sets `is_active=0`. */
  softDeleteItem: (
    templateId: number,
    itemId: number
  ) => Promise<TrainingItemRow>;
}

export const trainingTemplatesClient: TrainingTemplatesClient = {
  listTemplates: (options) =>
    requestList<TemplateWithItems>(
      `${TRAINING_TEMPLATES_API_BASE}${buildQuery(options)}`,
      { cache: "no-store" }
    ),
  createTemplate: (data) =>
    requestItem<TrainingTemplateRow>(TRAINING_TEMPLATES_API_BASE, {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify(data),
    }),
  updateTemplate: (id, data) =>
    requestItem<TrainingTemplateRow>(`${TRAINING_TEMPLATES_API_BASE}/${id}`, {
      method: "PATCH",
      headers: JSON_HEADERS,
      body: JSON.stringify(data),
    }),
  softDeleteTemplate: (id) =>
    requestItem<TrainingTemplateRow>(`${TRAINING_TEMPLATES_API_BASE}/${id}`, {
      method: "DELETE",
    }),
  listItems: (templateId, options) =>
    requestList<TrainingItemRow>(`${itemsBase(templateId)}${buildQuery(options)}`, {
      cache: "no-store",
    }),
  createItem: (templateId, data) =>
    requestItem<TrainingItemRow>(itemsBase(templateId), {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify(data),
    }),
  updateItem: (templateId, itemId, data) =>
    requestItem<TrainingItemRow>(`${itemsBase(templateId)}/${itemId}`, {
      method: "PATCH",
      headers: JSON_HEADERS,
      body: JSON.stringify(data),
    }),
  softDeleteItem: (templateId, itemId) =>
    requestItem<TrainingItemRow>(`${itemsBase(templateId)}/${itemId}`, {
      method: "DELETE",
    }),
};
