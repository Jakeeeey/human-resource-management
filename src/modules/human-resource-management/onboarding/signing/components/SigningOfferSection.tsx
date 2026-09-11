"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { JobOffer } from "../types/contracts";
import {
  useSigningEnvelopeFetch,
  type SignOfferResult,
} from "../providers/signingEnvelopeProvider";

// SigningOfferSection.tsx — the Job offer card: label + status badge + the
// ONE offer acceptance path. Acceptance is irreversible, so it is confirmed
// through an AlertDialog before the todo-11 route is called; the parent
// receives the post-recompute rows to lift into surface state.

interface SigningOfferSectionProps {
  offer: JobOffer | null;
  onAccepted: (result: SignOfferResult) => void;
}

function offerLabel(offer: JobOffer | null): string {
  if (!offer) return "No offer on file";
  if (offer.status === "signed") {
    return offer.signed_at ? `Signed — ${offer.signed_at}` : "Signed";
  }
  return offer.status;
}

export function SigningOfferSection({
  offer,
  onAccepted,
}: SigningOfferSectionProps) {
  const { signJobOffer } = useSigningEnvelopeFetch();
  const [accepting, setAccepting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const handleAcceptOffer = useCallback(async () => {
    if (!offer || offer.status === "signed" || accepting) return;
    setAccepting(true);
    try {
      const result = await signJobOffer(offer.id, null);
      toast.success("Offer accepted");
      onAccepted(result);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Offer acceptance failed");
    } finally {
      setAccepting(false);
    }
  }, [offer, accepting, signJobOffer, onAccepted]);

  const offerSigned = offer?.status === "signed";

  return (
    <section className="bg-card overflow-hidden rounded-2xl border border-border/50 shadow-sm">
      <div className="flex flex-col gap-2 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold sm:text-base">
            Job offer
          </h3>
          <p className="truncate text-xs text-muted-foreground">
            {offerLabel(offer)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={offerSigned ? "default" : "outline"}>
            {offer ? offer.status : "missing"}
          </Badge>
          {offer && !offerSigned && (
            <Button
              type="button"
              onClick={() => setConfirmOpen(true)}
              disabled={accepting}
              className="min-h-8 w-full sm:w-auto"
              title="Accept the offer — this unlocks the paperwork signatures"
            >
              {accepting ? "Accepting…" : "Accept offer"}
            </Button>
          )}
        </div>
      </div>
      {!offerSigned && (
        <p className="px-3 pb-3 text-xs text-muted-foreground sm:px-4">
          The envelope completes only when the offer is signed and every
          required document is signed.
        </p>
      )}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Accept this job offer?</AlertDialogTitle>
            <AlertDialogDescription>
              Accepting records your decision and unlocks the document
              signatures. This cannot be undone — the offer cannot be signed
              again afterwards.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleAcceptOffer()}>
              Accept offer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
