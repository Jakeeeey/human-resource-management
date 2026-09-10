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
} from "../providers/signingEnvelopeProvider";
import { SigningItemView } from "./SigningItemView";
import { SigningFilingPanel } from "./SigningFilingPanel";

// SigningSurface.tsx — the applicant's WHOLE signing set (todo 13 re-key).
// Replaces the per-template kiosk: the surface accepts the ONE offer and then
// signs EVERY `paperwork_item` of the applicant's batch (offer + full item
// set), delegating to the todo-11 offer route and the todo-12 per-item route.
// There is no per-template envelope selection — the unit of work is the
// applicant.

interface SigningSurfaceProps {
  applicantId: number;
  applicantName: string;
  envelope: SigningEnvelope;
  offer: JobOffer | null;
  paperworks: Paperworks | null;
  items: PaperworkItem[];
  templatesById: Map<number, PaperworkTemplate>;
  onChanged?: () => void;
}

function offerLabel(offer: JobOffer | null): string {
  if (!offer) return "No offer on file";
  if (offer.status === "signed") {
    return offer.signed_at ? `Signed — ${offer.signed_at}` : "Signed";
  }
  return offer.status;
}

export function SigningSurface({
  applicantId,
  applicantName,
  envelope,
  offer: initialOffer,
  paperworks: initialPaperworks,
  items: initialItems,
  templatesById,
  onChanged,
}: SigningSurfaceProps) {
  const { signJobOffer } = useSigningEnvelopeFetch();
  const [envelopeState, setEnvelopeState] = useState(envelope);
  const [offer, setOffer] = useState<JobOffer | null>(initialOffer);
  const [paperworks, setPaperworks] = useState<Paperworks | null>(
    initialPaperworks
  );
  const [items, setItems] = useState<PaperworkItem[]>(initialItems);
  const [accepting, setAccepting] = useState(false);

  const orderedItems = useMemo(
    () =>
      [...items].sort((a, b) => {
        const aTitle = templatesById.get(a.template_id)?.title ?? "";
        const bTitle = templatesById.get(b.template_id)?.title ?? "";
        return aTitle.localeCompare(bTitle);
      }),
    [items, templatesById]
  );

  const filedSummary = useMemo(
    () =>
      orderedItems.map((item) => ({
        id: item.id,
        templateTitle:
          templatesById.get(item.template_id)?.title ??
          `Template ${item.template_id}`,
        status: item.status,
        pdfFile: item.pdf_file,
      })),
    [orderedItems, templatesById]
  );

  const handleAcceptOffer = useCallback(async () => {
    if (!offer || offer.status === "signed" || accepting) return;
    setAccepting(true);
    try {
      const result = await signJobOffer(offer.id, null);
      setOffer(result.offer);
      setEnvelopeState(result.envelope);
      setPaperworks(result.paperworks);
      toast.success("Offer accepted");
      onChanged?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Offer acceptance failed");
    } finally {
      setAccepting(false);
    }
  }, [offer, accepting, signJobOffer, onChanged]);

  const handleItemSigned = useCallback(
    (result: SignItemResult) => {
      setItems((prev) =>
        prev.map((item) => (item.id === result.item.id ? result.item : item))
      );
      setEnvelopeState(result.envelope);
      setPaperworks(result.paperworks);
      onChanged?.();
    },
    [onChanged]
  );

  const offerSigned = offer?.status === "signed";
  const complete = envelopeState.status === "complete";

  return (
    <div className="space-y-6">
      <header className="bg-card overflow-hidden rounded-2xl border border-border/50 shadow-sm">
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
          </div>
        </div>
      </header>

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
                onClick={() => void handleAcceptOffer()}
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
      </section>

      {orderedItems.map((item) => (
        <SigningItemView
          key={item.id}
          applicantId={applicantId}
          item={item}
          template={templatesById.get(item.template_id) ?? null}
          onSigned={handleItemSigned}
        />
      ))}

      <SigningFilingPanel applicantId={applicantId} items={filedSummary} />
    </div>
  );
}
