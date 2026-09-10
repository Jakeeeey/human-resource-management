import type { ChecklistItem } from "./completionChecklist";

// completionTabData.ts — pure parsing/boundary helpers for CompletionTab
// (todo 22). Kept out of the component so each unit stays reviewable; nothing
// here fetches or renders.

export interface CompletionBody {
  success?: unknown;
  message?: unknown;
  data?: unknown;
}

export interface CheckState {
  userId: number;
  checklist: ChecklistItem[];
  ready: boolean;
  missing: ChecklistItem[];
}

export function parseObject(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function parseChecklist(value: unknown): ChecklistItem[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is ChecklistItem => {
    if (typeof item !== "object" || item === null) return false;
    const candidate = item as { key?: unknown; label?: unknown };
    return typeof candidate.key === "string" && typeof candidate.label === "string";
  });
}

export function readJson(res: Response): Promise<CompletionBody> {
  return res
    .json()
    .catch(() => ({}))
    .then((body: unknown) => (parseObject(body) ?? {}) as CompletionBody);
}

/** GET/POST share the `{ data: { user, checklist, ready, missing } }` shape. */
export function toCheckState(userId: number, body: CompletionBody): CheckState | null {
  const data = parseObject(body.data);
  if (!data) return null;
  const user = parseObject(data.user);
  return {
    userId:
      typeof user?.user_id === "number" && user.user_id > 0 ? user.user_id : userId,
    checklist: parseChecklist(data.checklist),
    ready: data.ready === true,
    missing: parseChecklist(data.missing),
  };
}
