"use client";

import { createContext, useContext, type ReactNode } from "react";

import type {
  JobOffer,
  PaperworkItem,
  Paperworks,
  SigningCompletion,
  SigningEnvelope,
} from "../types/contracts";

// signingEnvelopeProvider.tsx — client fetch layer for the APPLICANT-SCOPED
// signing API (todo 13 re-key). The signing aggregate is keyed by
// `applicant_id` (UNIQUE) and carries `joboffer_id` / `paperworks_id`; there
// is NO per-template envelope.
//
// Reads answer the four todo-9 list routes:
//   signing-envelope?applicant_id=  job-offer?applicant_id=
//   paperworks?applicant_id=        paperwork-item?paperworks_id=
// Writes answer the two signing routes:
//   PATCH job-offer/{id}         { signature_file?, strokes?, signed_pdf_file? } (todo 11)
//   PATCH paperwork-item/{id}    { strokes, pdf_file } (todo 12)
// Every mutation delegates to the server services — this layer never
// recomputes a rollup or writes a status itself.

interface ApiEnvelope<T> {
  success?: boolean;
  data?: T;
  message?: string;
}

export interface SignOfferResult {
  offer: JobOffer;
  envelope: SigningEnvelope;
  paperworks: Paperworks;
  requiredCount: number;
  signedCount: number;
  /** `"hired"`/null server truth for the applicant after this call. */
  applicantStatus: string | null;
  completion: SigningCompletion;
}

export interface SignJobOfferPayload {
  signature_file?: string | null;
  strokes?: string | null;
  signed_pdf_file?: string | null;
}

export interface SignItemResult {
  item: PaperworkItem;
  envelope: SigningEnvelope;
  paperworks: Paperworks;
  requiredCount: number;
  signedCount: number;
  /** `"hired"`/null server truth for the applicant after this call. */
  applicantStatus: string | null;
  completion: SigningCompletion;
}

interface SigningSetFetchContextType {
  listEnvelopes: (applicantId?: number) => Promise<SigningEnvelope[]>;
  listJobOffers: (applicantId?: number) => Promise<JobOffer[]>;
  listPaperworks: (applicantId?: number) => Promise<Paperworks[]>;
  listPaperworkItems: (paperworksId: number) => Promise<PaperworkItem[]>;
  /** Read-only hire-block preview: the specific missing prerequisite, or null. */
  previewHireBlockReason: (applicantId: number) => Promise<string | null>;
  signJobOffer: (
    offerId: number,
    payload: SignJobOfferPayload | null
  ) => Promise<SignOfferResult>;
  signPaperworkItem: (
    itemId: number,
    strokes: string,
    pdfFile: string
  ) => Promise<SignItemResult>;
}

const SigningSetFetchContext = createContext<
  SigningSetFetchContextType | undefined
>(undefined);

async function readList<T>(url: string): Promise<T[]> {
  const res = await fetch(url, { cache: "no-store" });
  const body = (await res.json().catch(() => null)) as ApiEnvelope<T[]> | null;
  if (!res.ok || !body?.success) {
    throw new Error(body?.message || "Request failed");
  }
  return Array.isArray(body.data) ? body.data : [];
}

async function patch<T>(url: string, payload: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = (await res.json().catch(() => null)) as ApiEnvelope<T> | null;
  if (!res.ok || !body?.success || !body.data) {
    throw new Error(body?.message || "Request failed");
  }
  return body.data;
}

async function readOne<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  const body = (await res.json().catch(() => null)) as ApiEnvelope<T> | null;
  if (!res.ok || !body?.success || body.data === undefined) {
    throw new Error(body?.message || "Request failed");
  }
  return body.data;
}

function scope(applicantId?: number): string {
  return applicantId === undefined ? "" : `?applicant_id=${applicantId}`;
}

export function SigningEnvelopeFetchProvider({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  const value: SigningSetFetchContextType = {
    listEnvelopes: (applicantId) =>
      readList<SigningEnvelope>(
        `/api/hrm/onboarding/signing-envelope${scope(applicantId)}`
      ),
    listJobOffers: (applicantId) =>
      readList<JobOffer>(`/api/hrm/onboarding/job-offer${scope(applicantId)}`),
    listPaperworks: (applicantId) =>
      readList<Paperworks>(`/api/hrm/onboarding/paperworks${scope(applicantId)}`),
    listPaperworkItems: (paperworksId) =>
      readList<PaperworkItem>(
        `/api/hrm/onboarding/paperwork-item?paperworks_id=${paperworksId}`
      ),
    previewHireBlockReason: async (applicantId) => {
      const data = await readOne<{ blockedReason: string | null }>(
        `/api/hrm/onboarding/signing-envelope/completion?applicant_id=${applicantId}`
      );
      return data.blockedReason ?? null;
    },
    signJobOffer: (offerId, payload) =>
      patch<SignOfferResult>(`/api/hrm/onboarding/job-offer/${offerId}`, {
        signature_file: payload?.signature_file ?? null,
        strokes: payload?.strokes ?? null,
        signed_pdf_file: payload?.signed_pdf_file ?? null,
      }),
    signPaperworkItem: (itemId, strokes, pdfFile) =>
      patch<SignItemResult>(`/api/hrm/onboarding/paperwork-item/${itemId}`, {
        strokes,
        pdf_file: pdfFile,
      }),
  };

  return (
    <SigningSetFetchContext.Provider value={value}>
      {children}
    </SigningSetFetchContext.Provider>
  );
}

export function useSigningEnvelopeFetch(): SigningSetFetchContextType {
  const ctx = useContext(SigningSetFetchContext);
  if (!ctx) {
    throw new Error(
      "useSigningEnvelopeFetch must be used inside SigningEnvelopeFetchProvider"
    );
  }
  return ctx;
}
