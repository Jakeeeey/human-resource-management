"use client";

import * as React from "react";
import type { Lookups, SalesmanRow } from "../types";
import { getLookups, listSalesmen } from "../../providers/fetchProvider";
import { toast } from "sonner";

export function useSalesmanQRCode() {
  const [loading, setLoading] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);

  const [lookups, setLookups] = React.useState<Lookups | null>(null);
  const [salesmen, setSalesmen] = React.useState<SalesmanRow[]>([]);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const [l, s] = await Promise.all([getLookups(), listSalesmen()]);
      setLookups(l.data);
      setSalesmen(s.data ?? []);
    } catch (e) {
      const err = e as Error;
      toast.error(err.message ?? "Failed to load Salesman QR Code data.");
    } finally {
      setLoading(false);
    }
  }, []);

  const refresh = React.useCallback(async () => {
    setRefreshing(true);
    try {
      const s = await listSalesmen();
      setSalesmen(s.data ?? []);
    } catch (e) {
      const err = e as Error;
      toast.error(err.message ?? "Failed to refresh salesmen.");
    } finally {
      setRefreshing(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  return {
    loading,
    refreshing,
    lookups,
    salesmen,
    setSalesmen,
    refresh,
    reloadAll: load,
  };
}
