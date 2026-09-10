import { z } from "zod";

// applicant-status.ts — the SINGLE status truth for `applicant.status`
// (todo 1 of onboarding-hub-replan).
//
// Mirrors the applied MySQL ENUM exactly: values are stored snake_case, no
// spaces, verbatim. Directus admin labels are display-only — code, filters,
// and writes all use these raw values.
//
// Terminal: `hired` (success), `rejected`, `withdrawn`. `incomplete` is
// transient (signing started, not all documents signed yet) and is always
// superseded by the next transition. There is NO history/event table and NO
// parallel derived-stage vocabulary — every module routes through the single
// status service (todo 2), never writing `applicant.status` directly and
// never writing the dropped `application.status`.

export const APPLICANT_STATUS = [
  "draft",
  "submitted",
  "quiz_completed",
  "initial_interview",
  "verdict_pending",
  "recommended",
  "final_interview",
  "final_approved",
  "for_signing",
  "incomplete",
  "hired",
  "rejected",
  "withdrawn",
] as const;

export type ApplicantStatus = (typeof APPLICANT_STATUS)[number];

export const ApplicantStatusSchema = z.enum(APPLICANT_STATUS);
