"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, ChevronDown, Circle, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

import {
  groupChecklistByPhase,
  readJson,
  toCheckState,
  type CheckState,
  type CompletionGroup,
} from "../completionTabData";

// CompletionTab.tsx — workspace Completion section keyed to the EMPLOYEE
// (todo 22). Re-checks the employee's task set through the completion GET and
// drives the POST that reports completion. The employee is the canonical hire
// from the route, so there is no picker and no roster fetch. The checklist is
// grouped by onboarding phase; every group is collapsible and paginates its
// own rows, mirroring the Overview phased task list.

const PAGE_SIZE = 5;

function GroupItems({ group }: { group: CompletionGroup }) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(group.items.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * PAGE_SIZE;
  const visibleItems = group.items.slice(start, start + PAGE_SIZE);

  return (
    <>
      <ul className="divide-y divide-border">
        {visibleItems.map((item) => (
          <li key={item.key} className="flex items-start gap-2 px-3 py-2">
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
      {totalPages > 1 ? (
        <div className="mt-3 flex flex-col gap-2 border-t border-border pt-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            Page {currentPage} of {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={currentPage <= 1}
              onClick={() => setPage(Math.max(1, currentPage - 1))}
            >
              Previous
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={currentPage >= totalPages}
              onClick={() => setPage(Math.min(totalPages, currentPage + 1))}
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}
    </>
  );
}

function CompletionGroupCard({ group }: { group: CompletionGroup }) {
  const [open, setOpen] = useState(false);
  const percent =
    group.total === 0 ? 0 : Math.round((group.done / group.total) * 100);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card className="shadow-none border-border overflow-hidden">
        <CollapsibleTrigger
          type="button"
          className="w-full rounded-xl text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="truncate" title={group.label}>
                {group.label}
              </CardTitle>
              <span className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                {group.done}/{group.total} done
                <ChevronDown
                  className={cn(
                    "h-4 w-4 transition-transform",
                    open && "rotate-180"
                  )}
                  aria-hidden="true"
                />
              </span>
            </div>
            <Progress
              className="mt-2 h-1.5"
              value={percent}
              aria-label={`${group.label} completion progress`}
            />
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0">
            <div className="overflow-hidden rounded-md border border-border">
              <GroupItems key={group.items.length} group={group} />
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

export function CompletionTab({ userId }: { userId: number }) {
  const [check, setCheck] = useState<CheckState | null>(null);
  const [loading, setLoading] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const runCheck = useCallback(async (id: number) => {
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/hrm/onboarding/completion?user_id=${id}`, {
        cache: "no-store",
      });
      const body = await readJson(res);
      const state = toCheckState(id, body);
      if (!res.ok || body.success !== true || !state) {
        setCheck(null);
        setError(
          typeof body.message === "string"
            ? body.message
            : "Completion check failed."
        );
        return;
      }
      setCheck(state);
    } catch {
      setCheck(null);
      setError("Completion check failed. Retry shortly.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void runCheck(userId);
  }, [userId, runCheck]);

  const runComplete = useCallback(async () => {
    setCompleting(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/hrm/onboarding/completion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId }),
      });
      const body = await readJson(res);
      const state = toCheckState(userId, body);
      if (!res.ok || body.success !== true) {
        if (state) setCheck(state);
        setError(
          typeof body.message === "string"
            ? body.message
            : "Completion blocked — see the missing tasks."
        );
        return;
      }
      setNotice("Onboarding complete — every required task is done.");
      await runCheck(userId);
    } catch {
      setError("Completion request failed. Retry shortly.");
    } finally {
      setCompleting(false);
    }
  }, [userId, runCheck]);

  const groups = check ? groupChecklistByPhase(check.checklist) : [];
  const requiredDone = check
    ? check.checklist.filter((item) => item.required && item.done).length
    : 0;
  const requiredTotal = check
    ? check.checklist.filter((item) => item.required).length
    : 0;

  return (
    <Card className="shadow-none border-border overflow-hidden">
      <CardHeader>
        <CardTitle className="max-w-[300px] truncate" title="Completion">
          Completion
        </CardTitle>
        <CardDescription>
          Employee task-set completion — every required onboarding task done.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
          <Button
            variant="outline"
            className="w-full sm:w-auto"
            disabled={loading}
            onClick={() => void runCheck(userId)}
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
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Required tasks: {requiredDone}/{requiredTotal} done
              {check.missing.length > 0
                ? ` · ${check.missing.length} still open`
                : ""}
            </p>

            <div className="grid gap-3">
              {groups.map((group) => (
                <CompletionGroupCard key={group.phase} group={group} />
              ))}
            </div>

            <Button
              className="w-full sm:w-auto"
              disabled={!check.ready || completing}
              onClick={() => void runComplete()}
            >
              {completing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : check.ready ? (
                "Verify completion"
              ) : (
                "Complete all required tasks first"
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
