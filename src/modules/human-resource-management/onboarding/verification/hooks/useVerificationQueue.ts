"use client";

// useVerificationQueue.ts — selection + dialog + decision intents over the
// verification fetch provider. Machine-gate refusals (400 reason strings from
// the verifications route) surface as-is so HR sees why a decision was
// refused.

import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import type { QueueDocument, QueueRow } from "../types/verification-queue.schema";
import { useVerificationFetch } from "../providers/verificationProvider";

export type VerificationDialog =
  | { kind: "none" }
  | { kind: "return"; row: QueueRow; doc: QueueDocument }
  | { kind: "details"; row: QueueRow; doc: QueueDocument };

export interface VerificationPreview {
  row: QueueRow;
  doc: QueueDocument;
}

/**
 * @param userId - The canonical selected hire from the workspace route. The
 * route returns the global queue and this hook scopes it to that employee.
 */
export function useVerificationQueue(userId: number) {
  const {
    queue,
    isLoading,
    isError,
    error,
    refetch,
    decideDocument,
  } = useVerificationFetch();

  const [dialog, setDialog] = useState<VerificationDialog>({ kind: "none" });
  const [preview, setPreview] = useState<VerificationPreview | null>(null);
  const [working, setWorking] = useState(false);

  const scopedRows = useMemo(
    () => (queue?.rows ?? []).filter((row) => row.userId === userId),
    [queue, userId]
  );

  const closeDialog = useCallback(() => {
    setDialog({ kind: "none" });
  }, []);

  const openReturn = useCallback((row: QueueRow, doc: QueueDocument) => {
    setDialog({ kind: "return", row, doc });
  }, []);

  const openPreview = useCallback((row: QueueRow, doc: QueueDocument) => {
    setPreview({ row, doc });
  }, []);

  const closePreview = useCallback(() => {
    setPreview(null);
  }, []);

  const openDetails = useCallback((row: QueueRow, doc: QueueDocument) => {
    setDialog({ kind: "details", row, doc });
  }, []);

  const closeDetails = useCallback(() => {
    setDialog({ kind: "none" });
  }, []);

  const approveDocument = useCallback(
    async (row: QueueRow, doc: QueueDocument) => {
      setWorking(true);
      try {
        await decideDocument({
          user_id: row.userId,
          doc_key: doc.docKey,
          decision: "approve",
        });
        toast.success("Document approved");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Approval refused");
      } finally {
        setWorking(false);
      }
    },
    [decideDocument]
  );

  const returnDocument = useCallback(
    async (row: QueueRow, doc: QueueDocument, reason: string) => {
      setWorking(true);
      try {
        await decideDocument({
          user_id: row.userId,
          doc_key: doc.docKey,
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
    [decideDocument, closeDialog]
  );

  return useMemo(
    () => ({
      rows: scopedRows,
      isLoading,
      isError,
      error,
      refetch,
      dialog,
      preview,
      working,
      openReturn,
      openPreview,
      openDetails,
      closeDialog,
      closeDetails,
      closePreview,
      approveDocument,
      returnDocument,
    }),
    [
      scopedRows,
      isLoading,
      isError,
      error,
      refetch,
      dialog,
      preview,
      working,
      openReturn,
      openPreview,
      openDetails,
      closeDialog,
      closeDetails,
      closePreview,
      approveDocument,
      returnDocument,
    ]
  );
}
