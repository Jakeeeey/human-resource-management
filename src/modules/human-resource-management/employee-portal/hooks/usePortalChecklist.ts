"use client";

// usePortalChecklist.ts — upload + checklist intents over the portal fetch
// provider. The form holds `File|null` (canon shape); only the returned
// `data.id` UUID is persisted via the link route. Checklist errors surface
// as-is so the hiree sees why an upload was refused (413/415 reasons).

import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { usePortalFetch } from "../providers/portalProvider";

export function usePortalChecklist() {
  const {
    session,
    checklist,
    isLoading,
    isError,
    error,
    refetch,
    uploadDocument,
  } = usePortalFetch();

  const [uploadingKey, setUploadingKey] = useState<string | null>(null);

  const upload = useCallback(
    async (docKey: string, file: File | null) => {
      if (!file) {
        toast.error("Choose a file to upload first");
        return;
      }
      setUploadingKey(docKey);
      try {
        await uploadDocument(docKey, file);
        toast.success("Document filed — checklist updated");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Upload failed");
      } finally {
        setUploadingKey(null);
      }
    },
    [uploadDocument]
  );

  return useMemo(
    () => ({
      session,
      checklist,
      isLoading,
      isError,
      error,
      refetch,
      upload,
      uploadingKey,
    }),
    [
      session,
      checklist,
      isLoading,
      isError,
      error,
      refetch,
      upload,
      uploadingKey,
    ]
  );
}
