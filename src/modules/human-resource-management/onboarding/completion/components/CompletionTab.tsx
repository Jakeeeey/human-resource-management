"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Circle, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { ChecklistItem } from "../completionChecklist";

// CompletionTab.tsx — HR completion surface (Todo 14). Reads the §10
// checklist through the orchestrator GET (re-check, never writes) and
// drives the single POST that writes ONBOARDING_COMPLETED. A refused hire
// renders the missing-item list; a completed hire shows the terminal state.
// Re-fire collapses server-side (`alreadyCompleted`, no rewrite/notify).

interface ProfileOption {
  id: number;
  employee_id: number;
  status: string;
}

interface CheckState {
  profile: ProfileOption;
  checklist: ChecklistItem[];
  ready: boolean;
  missing: ChecklistItem[];
}

async function readJson(res: Response): Promise<{
  success: boolean;
  data?: unknown;
  message?: string;
  checklist?: ChecklistItem[];
  missing?: ChecklistItem[];
  ready?: boolean;
  alreadyCompleted?: boolean;
}> {
  return (await res.json().catch(() => null)) as {
    success: boolean;
    data?: unknown;
    message?: string;
    checklist?: ChecklistItem[];
    missing?: ChecklistItem[];
    ready?: boolean;
    alreadyCompleted?: boolean;
  };
}

export function CompletionTab() {
  const [profiles, setProfiles] = useState<ProfileOption[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [check, setCheck] = useState<CheckState | null>(null);
  const [loading, setLoading] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadProfiles() {
      try {
        const res = await fetch("/api/hrm/onboarding/profiles", {
          cache: "no-store",
        });
        const body = await readJson(res);
        if (cancelled) return;
        const rows = Array.isArray(body.data) ? body.data : [];
        setProfiles(
          rows.filter(
            (row): row is ProfileOption =>
              typeof row === "object" &&
              row !== null &&
              typeof (row as ProfileOption).id === "number"
          )
        );
      } catch {
        if (!cancelled) setError("Profiles failed to load. Retry shortly.");
      }
    }
    void loadProfiles();
    return () => {
      cancelled = true;
    };
  }, []);

  const runCheck = useCallback(async (profileId: number) => {
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(
        `/api/hrm/onboarding/completion?profile_id=${profileId}`,
        { cache: "no-store" }
      );
      const body = await readJson(res);
      if (!res.ok || !body.success) {
        setCheck(null);
        setError(body.message ?? "Checklist read failed.");
        return;
      }
      const data = body.data as CheckState;
      setCheck({
        profile: data.profile,
        checklist: Array.isArray(data.checklist) ? data.checklist : [],
        ready: body.ready === true,
        missing: Array.isArray(body.missing) ? body.missing : [],
      });
    } catch {
      setCheck(null);
      setError("Checklist read failed. Retry shortly.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedId !== null) void runCheck(selectedId);
  }, [selectedId, runCheck]);

  const runComplete = useCallback(async () => {
    if (selectedId === null) return;
    setCompleting(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/hrm/onboarding/completion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile_id: selectedId }),
      });
      const body = await readJson(res);
      if (!res.ok || !body.success) {
        const missing = Array.isArray(body.missing) ? body.missing : [];
        if (Array.isArray(body.checklist)) {
          const data = body.data as CheckState | undefined;
          setCheck({
            profile: data?.profile ?? check?.profile ?? {
              id: selectedId,
              employee_id: 0,
              status: "",
            },
            checklist: (body.checklist as ChecklistItem[]) ?? [],
            ready: false,
            missing: (missing as ChecklistItem[]) ?? [],
          });
        }
        setError(
          body.message ?? "Completion refused — see the missing items."
        );
        return;
      }
      setNotice(
        body.alreadyCompleted === true
          ? "Onboarding already completed — re-fire collapsed."
          : "Onboarding completed — notification dispatched."
      );
      await runCheck(selectedId);
    } catch {
      setError("Completion request failed. Retry shortly.");
    } finally {
      setCompleting(false);
    }
  }, [selectedId, runCheck, check?.profile]);

  return (
    <Card className="shadow-none border-border overflow-hidden">
      <CardHeader>
        <CardTitle className="max-w-[300px] truncate" title="Completion">
          Completion
        </CardTitle>
        <CardDescription>
          Section-10 checklist orchestrator into ONBOARDING_COMPLETED.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <label
            htmlFor="onb-completion-profile"
            className="text-sm font-medium shrink-0"
          >
            Hire
          </label>
          <Select
            value={selectedId === null ? "" : String(selectedId)}
            onValueChange={(v) =>
              setSelectedId(v === "" ? null : Number(v))
            }
          >
            <SelectTrigger
              id="onb-completion-profile"
              className="h-9 w-full sm:max-w-[320px]"
              aria-label="Select hire"
            >
              <SelectValue placeholder="Select a hire…" />
            </SelectTrigger>
            <SelectContent className="max-h-60">
              {profiles.map((profile) => (
                <SelectItem key={profile.id} value={String(profile.id)}>
                  #{profile.employee_id} — {profile.status}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            className="w-full sm:w-auto"
            disabled={selectedId === null || loading}
            onClick={() => selectedId !== null && void runCheck(selectedId)}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Re-check"
            )}
          </Button>
        </div>

        {error && (
          <p className="text-sm text-destructive break-words">{error}</p>
        )}
        {notice && (
          <p className="text-sm text-emerald-600 dark:text-emerald-400 break-words">
            {notice}
          </p>
        )}

        {check && (
          <div className="space-y-2">
            <div className="overflow-x-auto">
              <ul className="min-w-[320px] divide-y divide-border rounded-md border border-border">
                {check.checklist.map((item) => (
                  <li
                    key={item.key}
                    className="flex items-start gap-2 px-3 py-2"
                  >
                    {item.done ? (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <Circle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium" title={item.label}>
                        {item.label}
                      </p>
                      <p className="text-xs text-muted-foreground break-words">
                        {item.detail}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
            <Button
              className="w-full sm:w-auto"
              disabled={!check.ready || completing || check.profile.status === "ONBOARDING_COMPLETED"}
              onClick={() => void runComplete()}
            >
              {completing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : check.profile.status === "ONBOARDING_COMPLETED" ? (
                "Completed"
              ) : (
                "Mark onboarding completed"
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
