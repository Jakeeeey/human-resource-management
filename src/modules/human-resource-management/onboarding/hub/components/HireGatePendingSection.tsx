"use client";

import { useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ChevronRight,
  Loader2,
  UserPlus,
} from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

import type { HireGatePendingItem } from "@/modules/human-resource-management/onboarding/hire/types/hire-gate.schema";
import { useHireGatePending } from "../hooks/useHireGatePending";
import { HIRE_ROSTER_REFRESH_EVENT } from "../hooks/useHireRoster";

const PROVISION_URL = "/api/hrm/onboarding/hire-gate/provision";

function PendingRow({
  item,
  onHealed,
}: {
  item: HireGatePendingItem;
  onHealed: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);

  if (item.userId !== null) {
    return (
      <Link
        href={`/hrm/onboarding/${item.userId}`}
        aria-label={`Open onboarding workspace for ${item.name}`}
        className="flex w-full items-center justify-between gap-3 rounded-xl border border-border px-4 py-3 text-left transition-colors hover:border-primary/50 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium" title={item.name}>
            {item.name}
          </span>
          <span className="mt-0.5 block truncate text-xs text-muted-foreground">
            {item.position ?? "Signing complete — continue in the workspace"}
          </span>
        </span>
        <ChevronRight
          className="h-4 w-4 shrink-0 text-muted-foreground"
          aria-hidden="true"
        />
      </Link>
    );
  }

  const retry = async () => {
    setBusy(true);
    setRetryError(null);
    try {
      const res = await fetch(PROVISION_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicant_id: item.applicantId }),
      });
      const body = (await res.json().catch(() => null)) as {
        success?: boolean;
        message?: string;
      } | null;
      if (!res.ok || !body?.success) {
        throw new Error(
          body?.message ?? "The hiree account could not be created yet."
        );
      }
      onHealed();
    } catch (err) {
      setRetryError(
        err instanceof Error
          ? err.message
          : "The hiree account could not be created yet."
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-border px-4 py-3">
      <p className="truncate text-sm font-medium" title={item.name}>
        {item.name}
      </p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {item.position ?? "Applicant"} · the hiree account is not ready yet, so
        the workspace cannot open — retry creating it below.
      </p>
      {retryError ? (
        <p className="mt-1 text-xs text-destructive break-words">{retryError}</p>
      ) : null}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="mt-2 w-full sm:w-auto"
        disabled={busy}
        onClick={() => void retry()}
      >
        {busy ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
        ) : (
          <UserPlus className="mr-2 h-4 w-4" aria-hidden="true" />
        )}
        {busy ? "Creating account…" : "Retry account creation"}
      </Button>
    </div>
  );
}

export function HireGatePendingSection() {
  const { pending, loading, error, refresh } = useHireGatePending();

  if (loading) {
    return (
      <div className="grid gap-3">
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" aria-hidden="true" />
        <AlertTitle>Could not load applicants awaiting onboarding</AlertTitle>
        <AlertDescription className="flex flex-col gap-2">
          <span>{error}</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full sm:w-auto"
            onClick={() => void refresh()}
          >
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  if (pending.length === 0) return null;

  return (
    <Card className="shadow-none border-border overflow-hidden">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserPlus className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          Ready for onboarding ({pending.length})
        </CardTitle>
        <CardDescription>
          Signing is complete — open each hiree&apos;s workspace to continue
          onboarding in the linear workflow.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        {pending.map((item) => (
          <PendingRow
            key={item.applicantId}
            item={item}
            onHealed={() => {
              void refresh();
              window.dispatchEvent(new Event(HIRE_ROSTER_REFRESH_EVENT));
            }}
          />
        ))}
      </CardContent>
    </Card>
  );
}
