import { z } from "zod";

import { dFetch } from "@/modules/human-resource-management/shared/utils/directus";

import type { DocumentVerificationState } from "../types/document-verification.schema";
import { DocumentVerificationSchema } from "../types/document-verification.schema";

export function phTimeNow(): string {
  return new Date().toLocaleString("sv-SE", { timeZone: "Asia/Manila" });
}

export interface DocumentVerificationEntry {
  state: DocumentVerificationState;
  reason: string | null;
}

const IdRowSchema = z.object({ id: z.number().int().positive() });

export async function listDocumentVerificationsByUser(): Promise<
  Map<number, Map<string, DocumentVerificationEntry>>
> {
  const body: unknown = await dFetch(
    "/items/onboarding_document_verification?fields=*&limit=-1"
  );
  const envelope = z.object({ data: z.array(z.unknown()) }).safeParse(body);
  if (!envelope.success) return new Map();
  const byUser = new Map<number, Map<string, DocumentVerificationEntry>>();
  for (const raw of envelope.data.data) {
    const parsed = DocumentVerificationSchema.safeParse(raw);
    if (!parsed.success) continue;
    const row = parsed.data;
    const byDoc =
      byUser.get(row.user_id) ?? new Map<string, DocumentVerificationEntry>();
    byDoc.set(row.doc_key, { state: row.state, reason: row.reason });
    byUser.set(row.user_id, byDoc);
  }
  return byUser;
}

export interface UpsertDocumentDecisionInput {
  userId: number;
  docKey: string;
  state: DocumentVerificationState;
  reason: string | null;
  decidedBy: number | null;
}

export async function upsertDocumentDecision(
  input: UpsertDocumentDecisionInput
): Promise<void> {
  const now = phTimeNow();
  const existingBody: unknown = await dFetch(
    `/items/onboarding_document_verification?filter[user_id][_eq]=${input.userId}&filter[doc_key][_eq]=${encodeURIComponent(input.docKey)}&fields=id&limit=1`
  );
  const existing = z
    .object({ data: z.array(IdRowSchema) })
    .safeParse(existingBody);
  const existingId = existing.success ? existing.data.data[0]?.id : undefined;

  if (existingId !== undefined) {
    await dFetch(`/items/onboarding_document_verification/${existingId}`, {
      method: "PATCH",
      body: JSON.stringify({
        state: input.state,
        reason: input.reason,
        decided_by: input.decidedBy,
        decided_at: now,
        updated_at: now,
        updated_by: input.decidedBy,
      }),
    });
    return;
  }

  await dFetch("/items/onboarding_document_verification", {
    method: "POST",
    body: JSON.stringify({
      user_id: input.userId,
      doc_key: input.docKey,
      state: input.state,
      reason: input.reason,
      decided_by: input.decidedBy,
      decided_at: now,
      created_at: now,
      created_by: input.decidedBy,
      updated_at: now,
      updated_by: input.decidedBy,
    }),
  });
}
