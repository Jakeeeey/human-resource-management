"use client";

import { AlertCircle, UserPlus } from "lucide-react";

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

import { useHireGatePending } from "../hooks/useHireGatePending";
import { HIRE_ROSTER_REFRESH_EVENT } from "../hooks/useHireRoster";
import { HireGateCard } from "./HireGateCard";

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
          Signing is complete and no account exists yet — decide how each
          applicant enters onboarding.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        {pending.map((item) => (
          <HireGateCard
            key={item.applicantId}
            applicantId={item.applicantId}
            onDone={() => {
              void refresh();
              window.dispatchEvent(new Event(HIRE_ROSTER_REFRESH_EVENT));
            }}
          />
        ))}
      </CardContent>
    </Card>
  );
}
