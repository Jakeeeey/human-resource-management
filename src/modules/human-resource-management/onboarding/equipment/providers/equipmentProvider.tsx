"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
} from "react";

import type {
  AcknowledgeEquipmentItemInput,
  IssueEquipmentItemInput,
} from "../types/equipment-issue.schema";

// equipmentProvider.tsx — client fetch layer for the equipment issue/ack
// routes. Thin context provider mirroring the hub profileProvider shape:
// status + issue + acknowledge + refetch with loading/error flags.
// Asset assignment is NEVER touched here (Master List owns assets).

export interface EquipmentItemStatus {
  key: string;
  label: string;
  issuer: string;
  required: boolean;
  source: string;
  issued: boolean;
  issuedAt: string | null;
  issuedBy: string | null;
  acked: boolean;
  ackedAt: string | null;
  ackedBy: string | null;
  ackMethod: string | null;
}

export interface EquipmentStatus {
  profileId: number;
  items: EquipmentItemStatus[];
  fullyEquipped: boolean;
}

interface EquipmentFetchContextType {
  status: EquipmentStatus | null;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: (profileId: number) => Promise<void>;
  issueItem: (input: IssueEquipmentItemInput) => Promise<void>;
  acknowledgeItem: (input: AcknowledgeEquipmentItemInput) => Promise<void>;
}

const EquipmentFetchContext = createContext<
  EquipmentFetchContextType | undefined
>(undefined);

const ISSUES_BASE = "/api/hrm/onboarding/equipment-issues";
const ACKS_BASE = "/api/hrm/onboarding/equipment-acks";
const STATUS_BASE = "/api/hrm/onboarding/equipment-status";

async function readBody(res: Response): Promise<{
  success: boolean;
  data?: EquipmentStatus;
  message?: string;
}> {
  return (await res.json().catch(() => null)) as {
    success: boolean;
    data?: EquipmentStatus;
    message?: string;
  };
}

export function EquipmentFetchProvider({
  children,
}: {
  children: React.ReactNode;
}): React.ReactNode {
  const [status, setStatus] = useState<EquipmentStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isError, setIsError] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const refetch = useCallback(async (profileId: number) => {
    try {
      setIsLoading(true);
      setIsError(false);
      const res = await fetch(`${STATUS_BASE}?profile_id=${profileId}`, {
        cache: "no-store",
      });
      const body = await readBody(res);
      if (!res.ok || !body.success) {
        throw new Error(body?.message || "Fetch failed");
      }
      setStatus(body.data ?? null);
    } catch (err) {
      setIsError(true);
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoading(false);
    }
  }, []);

  const issueItem = useCallback(
    async (input: IssueEquipmentItemInput) => {
      const res = await fetch(ISSUES_BASE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const body = await readBody(res);
      if (!res.ok || !body.success) {
        throw new Error(body?.message || "Issue failed");
      }
      await refetch(input.profile_id);
    },
    [refetch]
  );

  const acknowledgeItem = useCallback(
    async (input: AcknowledgeEquipmentItemInput) => {
      const res = await fetch(ACKS_BASE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const body = await readBody(res);
      if (!res.ok || !body.success) {
        throw new Error(body?.message || "Acknowledge failed");
      }
      await refetch(input.profile_id);
    },
    [refetch]
  );

  return (
    <EquipmentFetchContext.Provider
      value={{
        status,
        isLoading,
        isError,
        error,
        refetch,
        issueItem,
        acknowledgeItem,
      }}
    >
      {children}
    </EquipmentFetchContext.Provider>
  );
}

export function useEquipmentFetch(): EquipmentFetchContextType {
  const ctx = useContext(EquipmentFetchContext);
  if (!ctx) {
    throw new Error(
      "useEquipmentFetch must be used inside EquipmentFetchProvider"
    );
  }
  return ctx;
}
