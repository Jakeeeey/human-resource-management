import type {
  JobOfferStatus,
  PaperworkItemStatus,
  PaperworksStatus,
  SigningEnvelopeStatus,
} from "@/modules/human-resource-management/onboarding/signing/types/contracts";

// signingRollupRule.ts — THE pure derivation for the signing rollup (todo 12),
// split out of the service so the pending/partial/complete matrix and the
// empty-set guard are reviewable without a network round-trip.
// `signing-rollup-service.ts` is its only caller and remains the only writer
// of the derived columns.

export interface SigningRollupDerivation {
  signedCount: number;
  paperworksStatus: PaperworksStatus;
  envelopeStatus: SigningEnvelopeStatus;
}

/**
 * Derive both rollups from the source rows:
 * - `paperworks`: complete iff `required_count >= 1` AND `signed_count >=
 *   required_count` (all required signed); partial when some signed; else
 *   pending. `required_count = 0` can NEVER complete (empty-set guard —
 *   mirrors `canSigningSetFireHired`).
 * - `signing_envelope`: complete iff the offer is signed AND every item row is
 *   signed AND the required set is non-empty; otherwise pending.
 * @param input - Required count, every item status of the batch, offer status.
 * @returns Signed count + derived batch and envelope statuses.
 */
export function deriveSigningRollups(input: {
  requiredCount: number;
  itemStatuses: readonly PaperworkItemStatus[];
  offerStatus: JobOfferStatus | null;
}): SigningRollupDerivation {
  const signedCount = input.itemStatuses.filter(
    (status) => status === "signed"
  ).length;
  const allItemsSigned =
    input.itemStatuses.length > 0 &&
    input.itemStatuses.every((status) => status === "signed");
  const allRequiredSigned =
    input.requiredCount >= 1 && signedCount >= input.requiredCount;
  const paperworksStatus: PaperworksStatus = !allRequiredSigned
    ? signedCount > 0
      ? "partial"
      : "pending"
    : "complete";
  const envelopeStatus: SigningEnvelopeStatus =
    input.offerStatus === "signed" && allItemsSigned && allRequiredSigned
      ? "complete"
      : "pending";
  return { signedCount, paperworksStatus, envelopeStatus };
}
