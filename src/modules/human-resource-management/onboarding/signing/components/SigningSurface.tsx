"use client";

import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { PaperworkTemplate } from "../../paperwork/types/paperwork-template.schema";
import type {
  JobOffer,
  PaperworkItem,
  Paperworks,
  SigningEnvelope,
} from "../types/contracts";
import {
  useSigningEnvelopeFetch,
  type SignItemResult,
  type SignOfferResult,
} from "../providers/signingEnvelopeProvider";
import { SigningItemView } from "./SigningItemView";
import { SigningCompletionBanner } from "./SigningCompletionBanner";
import { SigningOfferSection } from "./SigningOfferSection";
import { useSigningSurfaceCompletion } from "./useSigningSurfaceCompletion";

// SigningSurface.tsx — the applicant's WHOLE signing set (todo 13 re-key).
// Replaces the per-template kiosk: the surface accepts the ONE offer and then
// signs EVERY `paperwork_item` of the applicant's batch (offer + full item
// set), delegating to the todo-11 offer route and the todo-12 per-item route.
// There is no per-template envelope selection — the unit of work is the
// applicant. The offer card / completion notice / filing summary are
// components; this file owns the shared set state.

interface SigningSurfaceProps {
  applicantId: number;
  applicantName: string;
  applicantStatus: string | null;
  envelope: SigningEnvelope;
  offer: JobOffer | null;
  paperworks: Paperworks | null;
  items: PaperworkItem[];
  templatesById: Map<number, PaperworkTemplate>;
  onChanged?: () => void;
}

export function SigningSurface({
  applicantId,
  applicantName,
  applicantStatus,
  envelope,
  offer: initialOffer,
  paperworks: initialPaperworks,
  items: initialItems,
  templatesById,
  onChanged,
}: SigningSurfaceProps) {
  const {
    signPaperworkItem,
    listEnvelopes,
    listJobOffers,
    listPaperworks,
    listPaperworkItems,
  } = useSigningEnvelopeFetch();
  const [envelopeState, setEnvelopeState] = useState(envelope);
  const [offer, setOffer] = useState<JobOffer | null>(initialOffer);
  const [paperworks, setPaperworks] = useState<Paperworks | null>(
    initialPaperworks
  );
  const [items, setItems] = useState<PaperworkItem[]>(initialItems);
  const [completion, setCompletion] = useSigningSurfaceCompletion({
    applicantId,
    envelopeStatus: envelopeState.status,
    applicantStatus,
  });
  const [retrying, setRetrying] = useState(false);

  const orderedItems = useMemo(
    () =>
      [...items].sort((a, b) => {
        const aTitle = templatesById.get(a.template_id)?.title ?? "";
        const bTitle = templatesById.get(b.template_id)?.title ?? "";
        return aTitle.localeCompare(bTitle);
      }),
    [items, templatesById]
  );

  const reloadSet = useCallback(async () => {
    try {
      const [envelopeRows, paperworksRows] = await Promise.all([
        listEnvelopes(applicantId),
        listPaperworks(applicantId),
      ]);
      if (envelopeRows[0]) setEnvelopeState(envelopeRows[0]);
      const nextPaperworks = paperworksRows[0] ?? null;
      setPaperworks(nextPaperworks);
      setItems(
        nextPaperworks ? await listPaperworkItems(nextPaperworks.id) : []
      );
    } catch {
      // Reconcile is best-effort — the mutation error was already toasted.
    }
  }, [applicantId, listEnvelopes, listPaperworks, listPaperworkItems]);

  const handleOfferAccepted = useCallback(
    (result: SignOfferResult) => {
      setOffer(result.offer);
      setEnvelopeState(result.envelope);
      setPaperworks(result.paperworks);
      setCompletion(result.completion);
      onChanged?.();
    },
    [onChanged, setCompletion]
  );

  const handleItemSigned = useCallback(
    (result: SignItemResult) => {
      setItems((prev) =>
        prev.map((item) => (item.id === result.item.id ? result.item : item))
      );
      setEnvelopeState(result.envelope);
      setPaperworks(result.paperworks);
      setCompletion(result.completion);
      onChanged?.();
    },
    [onChanged, setCompletion]
  );

  const handleOfferChanged = useCallback(async () => {
    try {
      const rows = await listJobOffers(applicantId);
      const next =
        rows.find((row) => row.applicant_id === applicantId) ?? rows[0] ?? null;
      setOffer(next);
      onChanged?.();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not refresh the offer"
      );
    }
  }, [applicantId, listJobOffers, onChanged]);

  const retryItem = useMemo(
    () =>
      items.find(
        (item) =>
          item.status === "signed" &&
          item.strokes !== null &&
          item.pdf_file !== null
      ) ?? null,
    [items]
  );

  const handleRetryCompletion = useCallback(async () => {
    if (!retryItem?.strokes || !retryItem.pdf_file || retrying) return;
    setRetrying(true);
    try {
      const result = await signPaperworkItem(
        retryItem.id,
        retryItem.strokes,
        retryItem.pdf_file
      );
      handleItemSigned(result);
      if (result.completion.kind === "hired") {
        toast.success("Completion finished — employee record is ready");
      } else {
        toast.warning("Completion is still blocked — see the notice above");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Retry failed");
      await reloadSet();
    } finally {
      setRetrying(false);
    }
  }, [
    retryItem,
    retrying,
    signPaperworkItem,
    handleItemSigned,
    reloadSet,
  ]);

  const offerSigned = offer?.status === "signed";
  const complete = envelopeState.status === "complete";
  const nextUnsigned =
    orderedItems.find((item) => item.status !== "signed") ?? null;

  const handleJumpToNext = useCallback(() => {
    if (!nextUnsigned) return;
    document
      .getElementById(`signing-item-${nextUnsigned.id}`)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [nextUnsigned]);

  return (
    <div className="space-y-6">
      <header className="sticky top-0 z-20 overflow-hidden rounded-2xl border border-border/50 bg-card shadow-sm">
        <div className="flex flex-col gap-2 border-b border-border px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4">
          <div className="min-w-0">
            <h2
              className="truncate text-base font-semibold sm:text-lg"
              title={applicantName}
            >
              {applicantName}
            </h2>
            <p className="truncate text-xs text-muted-foreground sm:text-sm">
              Applicant #{applicantId} — sign the offer and every required
              document.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={complete ? "default" : "secondary"}>
              Envelope: {envelopeState.status}
            </Badge>
            <Badge variant="outline">
              Paperworks: {paperworks?.status ?? "pending"} (
              {paperworks?.signed_count ?? 0}/
              {paperworks?.required_count ?? 0})
            </Badge>
            {nextUnsigned && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleJumpToNext}
                className="min-h-8 w-full sm:w-auto"
              >
                Next unsigned document
              </Button>
            )}
          </div>
        </div>
      </header>

      <SigningCompletionBanner
        completion={completion}
        envelopeStatus={envelopeState.status}
        applicantStatus={applicantStatus}
        retrying={retrying}
        onRetry={() => void handleRetryCompletion()}
      />

      <SigningOfferSection
        offer={offer}
        onAccepted={handleOfferAccepted}
        onOfferChanged={() => void handleOfferChanged()}
      />

      {orderedItems.map((item) => (
        <SigningItemView
          key={item.id}
          applicantId={applicantId}
          item={item}
          template={templatesById.get(item.template_id) ?? null}
          awaitingOffer={!offerSigned}
          defaultExpanded={item.id === nextUnsigned?.id}
          onReconcile={reloadSet}
          onSigned={handleItemSigned}
        />
      ))}
    </div>
  );
}
