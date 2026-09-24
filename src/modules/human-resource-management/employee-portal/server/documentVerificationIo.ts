import { z } from "zod";

import { dFetch } from "@/modules/human-resource-management/shared/utils/directus";

import { PortalDocVerificationStateSchema } from "../types/portal-checklist.schema";
import type { PortalDocVerificationState } from "../types/portal-checklist.schema";
import { nowUTC } from "@/lib/audit";

export interface DocumentVerificationEntry {
  state: PortalDocVerificationState;
  reason: string | null;
}

const VerificationRowSchema = z.object({
  doc_key: z.string().min(1).max(64),
  state: PortalDocVerificationStateSchema,
  reason: z.string().nullable(),
});

const ExistingRowSchema = z.object({
  id: z.number().int().positive(),
  state: PortalDocVerificationStateSchema,
});

export async function listDocumentVerificationsByUser(
  userId: number
): Promise<Map<string, DocumentVerificationEntry>> {
  const byDoc = new Map<string, DocumentVerificationEntry>();
  try {
    const body: unknown = await dFetch(
      `/items/onboarding_document_verification?filter[user_id][_eq]=${userId}&fields=doc_key,state,reason&limit=-1`
    );
    const envelope = z.object({ data: z.array(z.unknown()) }).safeParse(body);
    if (!envelope.success) return byDoc;
    for (const raw of envelope.data.data) {
      const parsed = VerificationRowSchema.safeParse(raw);
      if (!parsed.success) continue;
      byDoc.set(parsed.data.doc_key, {
        state: parsed.data.state,
        reason: parsed.data.reason,
      });
    }
  } catch {
    return new Map<string, DocumentVerificationEntry>();
  }
  return byDoc;
}

export async function resetDocumentVerificationIfPresent(
  userId: number,
  docKey: string
): Promise<void> {
  const existingBody: unknown = await dFetch(
    `/items/onboarding_document_verification?filter[user_id][_eq]=${userId}&filter[doc_key][_eq]=${encodeURIComponent(docKey)}&fields=id,state&limit=1`
  );
  const existing = z
    .object({ data: z.array(ExistingRowSchema) })
    .safeParse(existingBody);
  const row = existing.success ? existing.data.data[0] : undefined;
  if (row === undefined) return;
  const now = nowUTC();
  await dFetch(`/items/onboarding_document_verification/${row.id}`, {
    method: "PATCH",
    body: JSON.stringify({
      // Only a returned document counts as a RESUBMISSION; replacing a pending
      // or already-approved file just re-opens the slot for review.
      state: row.state === "returned" ? "resubmitted" : "pending",
      reason: null,
      decided_by: null,
      decided_at: null,
      updated_at: now,
      updated_by: userId,
    }),
  });
}
