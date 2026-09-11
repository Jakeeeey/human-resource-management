import type { PaperworkZone } from "../paperwork/types/paperwork-template.schema";
import type { PaperworkValidityVerdict } from "../paperwork/paperworkValidity";
import type { SigningCompletion } from "./types/contracts";

// signingCopy.ts — display-only humanizers for the signing surface. Zone ids
// like `zone-mtuv4x56-1` are storage keys, never hiree-facing copy; server
// error strings may carry `UPPERCASE_CODE:` prefixes that must not leak into
// toasts (QA.md §10).

export function zoneDisplayName(zone: PaperworkZone): string {
  const label = zone.label?.trim();
  if (label) return label;
  return `Signature line on page ${zone.page}`;
}

export function requiredZoneCountLabel(count: number): string {
  return count === 1 ? "1 required zone" : `${count} required zones`;
}

export function humanizeValidityReason(
  zones: PaperworkZone[],
  verdict: PaperworkValidityVerdict
): string {
  if (verdict.missingRequiredIds.length > 0) {
    const names = verdict.missingRequiredIds.map((id) => {
      const zone = zones.find((entry) => entry.id === id);
      return zone ? zoneDisplayName(zone) : "a signature zone";
    });
    return `Missing your signature in ${names.join(", ")}`;
  }
  return "This document is not ready to sign yet";
}

const MACHINE_CODE_PREFIX = /^[A-Z][A-Z0-9_]{2,}:\s*/;

export function humanizeCompletionReason(reason: string): string {
  const stripped = reason.replace(MACHINE_CODE_PREFIX, "").trim();
  return stripped || "an unexpected error";
}

export function isCompletionPending(
  envelopeStatus: string,
  applicantStatus: string | null | undefined
): boolean {
  return envelopeStatus === "complete" && applicantStatus !== "hired";
}

export function completionNeedsAttention(
  completion: SigningCompletion | null
): boolean {
  return (
    completion?.kind === "blocked" || completion?.kind === "failed"
  );
}
