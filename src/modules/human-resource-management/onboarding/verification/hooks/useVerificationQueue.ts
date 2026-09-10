"use client";

// useVerificationQueue.ts — selection + dialog + decision intents over the
// verification fetch provider. Machine-gate refusals (400 reason strings from
// the verifications route) surface as-is so HR sees why a decision was
// refused. Trail open/fetch/close intents mirror the memo-ack view-details
// shape (port, never import).

import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { buildDocRef } from "../types/acknowledgement-log.schema";
import type { AckMethod } from "../types/acknowledgement-log.schema";
import type { QueueRow } from "../types/verification-queue.schema";
import { useVerificationFetch } from "../providers/verificationProvider";

export type VerificationDialog =
  | { kind: "none" }
  | { kind: "return"; row: QueueRow }
  | { kind: "ack"; row: QueueRow }
  | { kind: "trail"; row: QueueRow };

export function useVerificationQueue() {
  const {
    queue,
    isLoading,
    isError,
    error,
    refetch,
    decide,
    recordAck,
    trail,
    fetchTrail,
    retryTrail,
    clearTrail,
  } = useVerificationFetch();

  const [dialog, setDialog] = useState<VerificationDialog>({ kind: "none" });
  const [working, setWorking] = useState(false);

  const closeDialog = useCallback(() => {
    setDialog({ kind: "none" });
  }, []);

  const openReturn = useCallback((row: QueueRow) => {
    setDialog({ kind: "return", row });
  }, []);

  const openAck = useCallback((row: QueueRow) => {
    setDialog({ kind: "ack", row });
  }, []);

  const openTrail = useCallback(
    (row: QueueRow) => {
      setDialog({ kind: "trail", row });
      void fetchTrail(buildDocRef(row.profile.id));
    },
    [fetchTrail]
  );

  const closeTrail = useCallback(() => {
    setDialog({ kind: "none" });
    clearTrail();
  }, [clearTrail]);

  const approve = useCallback(
    async (row: QueueRow) => {
      setWorking(true);
      try {
        await decide({ profile_id: row.profile.id, decision: "approve" });
        toast.success(`Employee #${row.profile.employee_id} verified`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Approval refused");
      } finally {
        setWorking(false);
      }
    },
    [decide]
  );

  const submitReturn = useCallback(
    async (row: QueueRow, reason: string) => {
      setWorking(true);
      try {
        await decide({
          profile_id: row.profile.id,
          decision: "return",
          reason,
        });
        toast.success("Returned for resubmit with reason");
        closeDialog();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Return refused");
      } finally {
        setWorking(false);
      }
    },
    [decide, closeDialog]
  );

  const resubmit = useCallback(
    async (row: QueueRow) => {
      setWorking(true);
      try {
        await decide({ profile_id: row.profile.id, decision: "resubmit" });
        toast.success("Resubmitted — back in the pending queue");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Resubmit refused");
      } finally {
        setWorking(false);
      }
    },
    [decide]
  );

  const submitAck = useCallback(
    async (row: QueueRow, signer: string, method: AckMethod) => {
      setWorking(true);
      try {
        await recordAck({
          doc_ref: buildDocRef(row.profile.id),
          signer,
          method,
        });
        toast.success("Acknowledgement recorded");
        closeDialog();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Record failed");
      } finally {
        setWorking(false);
      }
    },
    [recordAck, closeDialog]
  );

  return useMemo(
    () => ({
      rows: queue?.rows ?? [],
      counts: queue?.counts ?? { pending: 0, returned: 0, approved: 0 },
      isLoading,
      isError,
      error,
      refetch,
      dialog,
      working,
      openReturn,
      openAck,
      openTrail,
      closeDialog,
      closeTrail,
      approve,
      submitReturn,
      resubmit,
      submitAck,
      trail,
      retryTrail,
    }),
    [
      queue,
      isLoading,
      isError,
      error,
      refetch,
      dialog,
      working,
      openReturn,
      openAck,
      openTrail,
      closeDialog,
      closeTrail,
      approve,
      submitReturn,
      resubmit,
      submitAck,
      trail,
      retryTrail,
    ]
  );
}
