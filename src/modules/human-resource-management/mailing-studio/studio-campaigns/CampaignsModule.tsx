"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ChevronsUpDown, Loader2, Megaphone, MoreVertical, RefreshCw, SearchX } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

import { CampaignDangerDialog } from "./components/CampaignDangerDialog";
import { CampaignFormDialog, type CampaignFormValues } from "./components/CampaignFormDialog";
import { CampaignQueueDialog } from "./components/CampaignQueueDialog";
import { CampaignScheduleDialog } from "./components/CampaignScheduleDialog";
import { CampaignStatusBadge } from "./components/CampaignStatusBadge";
import { CampaignTestSendDialog } from "./components/CampaignTestSendDialog";
import { MsPager } from "./components/MsPager";
import { useCampaignsContext } from "./providers/CampaignsProvider";
import {
    listCampaignGroups,
    listCampaignTemplates,
    type CampaignConfirmCounts,
    type CampaignGroupOption,
    type CampaignSort,
    type CampaignTemplateOption,
    type CampaignTestSendData,
} from "./providers/campaignsClient";
import { CAMPAIGN_STATUSES, CAMPAIGN_STATUS_LABELS, type CampaignStatus, type MsCampaignRow } from "./types";
import type { CampaignStatusFilter } from "./hooks/useCampaigns";
import { formatPHT } from "./utils/time";

type SortColumn = "campaign_name" | "status" | "created";

const DELETABLE_STATUSES: readonly CampaignStatus[] = ["draft", "scheduled", "cancelled", "sent", "failed"];

const SEARCH_DEBOUNCE_MS = 350;

interface ExpandBanner {
    campaignId: number;
    campaignName: string;
    queued: number;
    alreadyQueued: number;
    total: number;
    repeated: boolean;
}

interface CancelBanner {
    campaignName: string;
    skipped: number;
}

interface DangerTarget {
    kind: "cancel" | "delete";
    row: MsCampaignRow;
}

interface FormTarget {
    mode: "create" | "edit";
    row: MsCampaignRow | null;
}

function groupIdsOf(row: MsCampaignRow): number[] {
    if (!Array.isArray(row.group_ids)) return [];
    return row.group_ids.filter((entry): entry is number => typeof entry === "number");
}

function progressPercent(sent: number, total: number): number {
    if (total <= 0) return 0;
    return Math.min(100, Math.round((sent / total) * 100));
}

function columnDirection(column: SortColumn, sort: CampaignSort): "asc" | "desc" | null {
    if (column === "campaign_name") return sort === "name-asc" ? "asc" : sort === "name-desc" ? "desc" : null;
    if (column === "status") return sort === "status-asc" ? "asc" : sort === "status-desc" ? "desc" : null;
    return sort === "created-asc" ? "asc" : sort === "created-desc" ? "desc" : null;
}

function sortValueFor(column: SortColumn, direction: "asc" | "desc"): CampaignSort {
    if (column === "campaign_name") return direction === "asc" ? "name-asc" : "name-desc";
    if (column === "status") return direction === "asc" ? "status-asc" : "status-desc";
    return direction === "asc" ? "created-asc" : "created-desc";
}

function SortIndicator({ direction }: { readonly direction: "asc" | "desc" | null }) {
    if (direction === "asc") return <ArrowUp aria-hidden="true" className="h-3 w-3" />;
    if (direction === "desc") return <ArrowDown aria-hidden="true" className="h-3 w-3" />;
    return <ChevronsUpDown aria-hidden="true" className="h-3 w-3 opacity-50" />;
}

function SortableHead({
    column,
    label,
    sort,
    onSort,
}: {
    readonly column: SortColumn;
    readonly label: string;
    readonly sort: CampaignSort;
    readonly onSort: (column: SortColumn) => void;
}) {
    const direction = columnDirection(column, sort);
    return (
        <TableHead aria-sort={direction === "asc" ? "ascending" : direction === "desc" ? "descending" : "none"}>
            <button
                className="inline-flex items-center gap-1 font-medium text-muted-foreground hover:text-foreground"
                type="button"
                onClick={() => onSort(column)}
            >
                {label}
                <SortIndicator direction={direction} />
            </button>
        </TableHead>
    );
}

export function CampaignsModule() {
    const {
        data,
        total,
        query,
        setQuery,
        isLoading,
        error,
        refresh,
        actionError,
        notice,
        busyKey,
        confirmItem,
        expandItem,
        cancelItem,
        scheduleItem,
        testSendItem,
        createItem,
        updateItem,
        removeItem,
        clearOutcome,
        dismissNotice,
    } = useCampaignsContext();

    const router = useRouter();
    const [searchInput, setSearchInput] = useState("");
    const [templates, setTemplates] = useState<CampaignTemplateOption[]>([]);
    const [groups, setGroups] = useState<CampaignGroupOption[]>([]);
    const [lookupsLoading, setLookupsLoading] = useState(true);
    const [formTarget, setFormTarget] = useState<FormTarget | null>(null);
    const [queueTarget, setQueueTarget] = useState<MsCampaignRow | null>(null);
    const [queueCounts, setQueueCounts] = useState<CampaignConfirmCounts | null>(null);
    const [queueError, setQueueError] = useState<string | null>(null);
    const [dangerTarget, setDangerTarget] = useState<DangerTarget | null>(null);
    const [testTarget, setTestTarget] = useState<MsCampaignRow | null>(null);
    const [testResult, setTestResult] = useState<CampaignTestSendData | null>(null);
    const [testError, setTestError] = useState<string | null>(null);
    const [scheduleTarget, setScheduleTarget] = useState<MsCampaignRow | null>(null);
    const [scheduleCounts, setScheduleCounts] = useState<CampaignConfirmCounts | null>(null);
    const [scheduleNonce, setScheduleNonce] = useState(0);
    const [scheduleError, setScheduleError] = useState<string | null>(null);
    const [expandBanner, setExpandBanner] = useState<ExpandBanner | null>(null);
    const [cancelBanner, setCancelBanner] = useState<CancelBanner | null>(null);

    useEffect(() => {
        let live = true;
        const load = async (): Promise<void> => {
            setLookupsLoading(true);
            try {
                const [fetchedTemplates, fetchedGroups] = await Promise.all([listCampaignTemplates(), listCampaignGroups()]);
                if (live) {
                    setTemplates(fetchedTemplates);
                    setGroups(fetchedGroups);
                }
            } catch {
                if (live) {
                    setTemplates([]);
                    setGroups([]);
                }
            } finally {
                if (live) setLookupsLoading(false);
            }
        };
        void load();
        return () => {
            live = false;
        };
    }, []);

    useEffect(() => {
        const timer = window.setTimeout(() => {
            setQuery({ search: searchInput.trim() });
        }, SEARCH_DEBOUNCE_MS);
        return () => window.clearTimeout(timer);
    }, [searchInput, setQuery]);

    const rows = useMemo(() => data ?? [], [data]);

    useEffect(() => {
        if (!data || isLoading || error) return;
        if (total > 0 && rows.length === 0 && query.page > 1) {
            setQuery({ page: 1 });
        }
    }, [data, isLoading, error, total, rows.length, query.page, setQuery]);

    const templateNames = useMemo(() => {
        const map = new Map<number, string>();
        for (const row of templates) map.set(row.id, row.template_name);
        return map;
    }, [templates]);

    const groupNames = useMemo(() => {
        const map = new Map<number, string>();
        for (const row of groups) map.set(row.id, row.group_name);
        return map;
    }, [groups]);

    const expandRow = useMemo(
        () => (expandBanner ? (rows.find((row) => row.id === expandBanner.campaignId) ?? null) : null),
        [rows, expandBanner]
    );

    useEffect(() => {
        if (!expandRow) return undefined;
        if (expandRow.status === "sent" || expandRow.status === "failed" || expandRow.status === "cancelled") return undefined;
        const timer = window.setInterval(() => {
            void refresh();
        }, 5000);
        return () => window.clearInterval(timer);
    }, [expandRow, refresh]);

    const expandRowStatus = expandRow?.status ?? null;

    useEffect(() => {
        if (!expandBanner) return undefined;
        if (expandRowStatus !== "sent" && expandRowStatus !== "cancelled") return undefined;
        const timer = window.setTimeout(() => setExpandBanner(null), 6000);
        return () => window.clearTimeout(timer);
    }, [expandBanner, expandRowStatus]);

    useEffect(() => {
        if (!notice) return undefined;
        const timer = window.setTimeout(() => dismissNotice(), 6000);
        return () => window.clearTimeout(timer);
    }, [notice, dismissNotice]);

    useEffect(() => {
        if (!cancelBanner) return undefined;
        const timer = window.setTimeout(() => setCancelBanner(null), 6000);
        return () => window.clearTimeout(timer);
    }, [cancelBanner]);

    const toggleSort = (column: SortColumn): void => {
        const direction: "asc" | "desc" = columnDirection(column, query.sort) === "asc" ? "desc" : "asc";
        setQuery({ sort: sortValueFor(column, direction) });
    };

    const openQueue = (row: MsCampaignRow): void => {
        clearOutcome();
        setQueueTarget(row);
        setQueueCounts(null);
        setQueueError(null);
        void confirmItem(row.id).then((state) => {
            if (state && state.id === row.id) {
                setQueueCounts(state.counts);
            } else {
                setQueueError("Audience counts are unavailable right now — please try again.");
            }
        });
    };

    const handleExpand = async (): Promise<void> => {
        if (!queueTarget) return;
        const state = await expandItem(queueTarget.id);
        if (state && state.id === queueTarget.id) {
            setQueueTarget(null);
            setQueueCounts(null);
            setExpandBanner({
                campaignId: queueTarget.id,
                campaignName: state.outcome.campaign.campaign_name,
                queued: state.outcome.queued,
                alreadyQueued: state.outcome.alreadyQueued,
                total: state.outcome.total_count,
                repeated: state.repeated,
            });
        } else {
            setQueueError("Queuing failed — please try again.");
        }
    };

    const openSchedule = (row: MsCampaignRow): void => {
        clearOutcome();
        setScheduleTarget(row);
        setScheduleCounts(null);
        setScheduleError(null);
        setScheduleNonce((nonce) => nonce + 1);
        void confirmItem(row.id).then((state) => {
            if (state && state.id === row.id) {
                setScheduleCounts(state.counts);
            } else {
                setScheduleError("Audience counts are unavailable right now — please try again.");
            }
        });
    };

    const handleScheduleConfirm = async (scheduledAt: string): Promise<void> => {
        if (!scheduleTarget) return;
        const state = await scheduleItem(scheduleTarget.id, scheduledAt);
        if (state && state.id === scheduleTarget.id) {
            setScheduleTarget(null);
            setScheduleError(null);
        } else {
            setScheduleError("Scheduling failed — please try again.");
        }
    };

    const handleUnschedule = async (row: MsCampaignRow): Promise<void> => {
        await scheduleItem(row.id, null);
    };

    const handleDangerConfirm = async (): Promise<void> => {
        if (!dangerTarget) return;
        if (dangerTarget.kind === "cancel") {
            const state = await cancelItem(dangerTarget.row.id);
            if (state) {
                setCancelBanner({ campaignName: dangerTarget.row.campaign_name, skipped: state.outcome.skipped });
                setDangerTarget(null);
            }
        } else {
            const ok = await removeItem(dangerTarget.row.id);
            if (ok) setDangerTarget(null);
        }
    };

    const handleTestSend = async (seeds: string[]): Promise<void> => {
        if (!testTarget) return;
        setTestError(null);
        const state = await testSendItem(testTarget.id, seeds);
        if (state && state.id === testTarget.id) {
            setTestResult(state.outcome);
        } else {
            setTestError("Test send failed — please try again.");
        }
    };

    const handleFormSubmit = async (values: CampaignFormValues): Promise<boolean> => {
        if (formTarget?.mode === "edit" && formTarget.row) {
            const row = await updateItem(formTarget.row.id, {
                campaign_name: values.campaign_name,
                template_id: values.template_id,
                group_ids: values.group_ids,
            });
            return row !== null;
        }
        const row = await createItem({
            campaign_key: values.campaign_key,
            campaign_name: values.campaign_name,
            template_id: values.template_id,
            group_ids: values.group_ids,
        });
        if (row !== null) setQuery({ page: 1 });
        return row !== null;
    };

    const queueBusy = queueTarget !== null && busyKey === `confirm:${queueTarget.id}`;
    const queueExpanding = queueTarget !== null && busyKey === `expand:${queueTarget.id}`;
    const scheduleBusy = scheduleTarget !== null && busyKey === `schedule:${scheduleTarget.id}`;
    const scheduleCountsBusy = scheduleTarget !== null && busyKey === `confirm:${scheduleTarget.id}`;
    const formBusy =
        busyKey === "create" || (formTarget?.mode === "edit" && formTarget.row !== null && busyKey === `update:${formTarget.row.id}`);
    const dangerBusy =
        dangerTarget !== null &&
        (busyKey === `cancel:${dangerTarget.row.id}` || busyKey === `delete:${dangerTarget.row.id}`);
    const testBusy = testTarget !== null && busyKey === `test:${testTarget.id}`;

    const totalPages = Math.max(1, Math.ceil(total / query.limit));
    const rangeStart = total === 0 || rows.length === 0 ? 0 : (query.page - 1) * query.limit + 1;
    const rangeEnd = rows.length === 0 ? 0 : (query.page - 1) * query.limit + rows.length;
    const filtersActive = query.status !== "all" || query.search.trim() !== "";

    const expandComplete =
        expandRow?.status === "sent" || expandRow?.status === "failed" || expandRow?.status === "cancelled";
    const expandTitle =
        expandRow?.status === "sent"
            ? "Sent — delivery complete."
            : expandRow?.status === "failed"
              ? "Send failed — check the outbox for details."
              : expandRow?.status === "cancelled"
                ? "Cancelled — pending sends were skipped."
                : expandBanner?.repeated
                  ? "Already queued — sending is in progress."
                  : "Queued — sending is in progress.";

    return (
        <section aria-label="Campaigns" className="flex min-h-0 flex-1 flex-col gap-4">
            <header className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                    <span className="p-3 bg-primary/10 rounded-2xl text-primary">
                        <Megaphone className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                        <h1 className="text-lg font-semibold tracking-tight">Campaigns</h1>
                        <p className="text-sm text-muted-foreground">Draft, schedule, send, and cancel bulk sends.</p>
                    </div>
                </div>
                <Button
                    aria-label="New campaign"
                    className="min-h-11 md:min-h-0"
                    size="sm"
                    onClick={() => setFormTarget({ mode: "create", row: null })}
                >
                    New campaign
                </Button>
            </header>

            <div className="flex flex-wrap items-center gap-2">
                <Input
                    aria-label="Search campaigns"
                    className="h-8 w-full text-xs sm:max-w-xs"
                    placeholder="Search name or key…"
                    value={searchInput}
                    onChange={(event) => setSearchInput(event.target.value)}
                />
                <Select value={query.status} onValueChange={(next) => setQuery({ status: next as CampaignStatusFilter })}>
                    <SelectTrigger aria-label="Filter campaigns by status" className="h-8 max-w-[220px] text-xs" size="sm">
                        <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent className="max-h-60">
                        <SelectItem value="all">All statuses</SelectItem>
                        {CAMPAIGN_STATUSES.map((status) => (
                            <SelectItem key={status} value={status}>
                                {CAMPAIGN_STATUS_LABELS[status]}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <Button
                    aria-label="Refresh campaigns"
                    className="min-h-11 md:min-h-0"
                    disabled={isLoading}
                    size="sm"
                    variant="outline"
                    onClick={() => void refresh()}
                >
                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    Refresh
                </Button>
                {data ? (
                    <span
                        aria-label={`${total} campaign${total === 1 ? "" : "s"}`}
                        aria-live="polite"
                        className="ms-auto rounded-full border bg-muted px-2.5 py-0.5 text-[11px] text-muted-foreground tabular-nums"
                        data-testid="campaigns-count"
                    >
                        {total}
                    </span>
                ) : null}
            </div>

            {isLoading && !data ? (
                <div className="flex flex-col gap-2" role="status" aria-label="Loading campaigns">
                    {[0, 1].map((index) => (
                        <div className="flex flex-col gap-2 rounded-lg border bg-card p-3" key={index}>
                            <Skeleton className="h-4 w-1/3" />
                            <Skeleton className="h-3 w-2/3" />
                        </div>
                    ))}
                    <span className="sr-only">Loading campaigns…</span>
                </div>
            ) : null}

            {error ? (
                <div className="rounded-lg border border-destructive/40 bg-card p-4" role="alert">
                    <p className="text-sm text-destructive">{error}</p>
                    <Button className="mt-2 min-h-11 md:min-h-0" size="sm" variant="outline" onClick={() => void refresh()}>
                        Retry
                    </Button>
                </div>
            ) : null}

            {expandBanner ? (
                <div className="rounded-lg border border-amber-500/30 bg-card p-4" role="status">
                    <div className="flex items-center gap-2">
                        {!expandComplete ? <Loader2 className="h-4 w-4 animate-spin text-amber-600 dark:text-amber-400" /> : null}
                        <p className="text-sm font-medium">{expandTitle}</p>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                        {expandBanner.repeated
                            ? `“${expandBanner.campaignName}” was expanded before — keeping the existing queue of ${expandBanner.total} recipients (${expandBanner.alreadyQueued} already queued).`
                            : `“${expandBanner.campaignName}” queued ${expandBanner.queued} recipients${expandBanner.alreadyQueued > 0 ? ` (${expandBanner.alreadyQueued} were already queued)` : ""} — ${expandBanner.total} total.`}
                    </p>
                    <Button className="mt-2 min-h-11 md:min-h-0" size="sm" variant="outline" onClick={() => setExpandBanner(null)}>
                        Dismiss
                    </Button>
                </div>
            ) : null}

            {notice ? (
                <div className="rounded-lg border border-amber-500/30 bg-card p-4" role="status">
                    <p className="text-sm text-amber-700 dark:text-amber-400">{notice}</p>
                    <Button className="mt-2 min-h-11 md:min-h-0" size="sm" variant="outline" onClick={dismissNotice}>
                        Dismiss
                    </Button>
                </div>
            ) : null}

            {cancelBanner ? (
                <div className="rounded-lg border bg-card p-4" role="status">
                    <p className="text-sm font-medium">“{cancelBanner.campaignName}” cancelled.</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{cancelBanner.skipped} pending sends skipped.</p>
                    <Button className="mt-2 min-h-11 md:min-h-0" size="sm" variant="outline" onClick={() => setCancelBanner(null)}>
                        Dismiss
                    </Button>
                </div>
            ) : null}

            {actionError && !queueTarget && !dangerTarget && !testTarget && !scheduleTarget ? (
                <div className="rounded-lg border border-destructive/40 bg-card p-4" role="alert">
                    <p className="text-sm text-destructive">{actionError}</p>
                </div>
            ) : null}

            {!isLoading && !error && data && total === 0 && !filtersActive ? (
                <div className="flex flex-col items-center gap-2 rounded-lg border bg-card px-4 py-16 text-center">
                    <Megaphone aria-hidden="true" className="size-8 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">No campaigns yet.</p>
                    <Button className="min-h-11 md:min-h-0" size="sm" onClick={() => setFormTarget({ mode: "create", row: null })}>
                        Create the first campaign
                    </Button>
                </div>
            ) : null}

            {!isLoading && !error && data && total === 0 && filtersActive ? (
                <div className="flex flex-col items-center gap-2 rounded-lg border bg-card px-4 py-16 text-center">
                    <SearchX aria-hidden="true" className="size-8 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">No campaigns match the current filters.</p>
                    <p className="text-xs text-muted-foreground">Try a different search or status.</p>
                </div>
            ) : null}

            {rows.length > 0 ? (
                <div className="overflow-hidden rounded-lg border bg-card">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <SortableHead column="campaign_name" label="Campaign" sort={query.sort} onSort={toggleSort} />
                                <TableHead>Template</TableHead>
                                <TableHead>Groups</TableHead>
                                <SortableHead column="status" label="Status" sort={query.sort} onSort={toggleSort} />
                                <TableHead>Progress</TableHead>
                                <SortableHead column="created" label="Created" sort={query.sort} onSort={toggleSort} />
                                <TableHead className="sticky right-0 w-12 bg-card">
                                    <span className="sr-only">Actions</span>
                                </TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {rows.map((row) => {
                                const isDraft = row.status === "draft";
                                const isScheduled = row.status === "scheduled";
                                const canDelete = DELETABLE_STATUSES.includes(row.status);
                                const canSendNow = row.status === "draft" || row.status === "scheduled";
                                const canSchedule = row.status === "draft" || row.status === "scheduled";
                                const canUnschedule = row.status === "scheduled";
                                const canResend = row.status === "sent" || row.status === "cancelled" || row.status === "failed";
                                const canCancel = row.status === "queued" || row.status === "sending";
                                const canTest = row.template_id !== null && row.template_id !== undefined;
                                const hasActions = canSendNow || canResend || isDraft || canCancel || canTest || canDelete || canSchedule || canUnschedule;
                                const ids = groupIdsOf(row);
                                const names = ids.map((id) => groupNames.get(id) ?? "Unknown group");
                                const rowBusy = busyKey !== null && busyKey.endsWith(`:${row.id}`);
                                return (
                                    <TableRow
                                        className="cursor-pointer"
                                        key={row.id}
                                        onClick={(event) => {
                                            if (window.getSelection()?.toString() !== "") return;
                                            const target = event.target as HTMLElement;
                                            if (target.closest("button,a,input,select,textarea,[role='menuitem'],[role='menu'],[role='dialog']")) return;
                                            router.push(`/hrm/mailing-studio/studio-campaigns/${row.id}`);
                                        }}
                                    >
                                        <TableCell className="max-w-[14rem]">
                                            <div className="flex w-48 min-w-0 flex-col sm:w-56">
                                                <Link
                                                    className="truncate text-sm font-medium underline-offset-2 hover:underline focus-visible:underline"
                                                    href={`/hrm/mailing-studio/studio-campaigns/${row.id}`}
                                                    title={row.campaign_name}
                                                >
                                                    {row.campaign_name}
                                                </Link>
                                                <span className="truncate font-mono text-xs text-muted-foreground" title={row.campaign_key}>
                                                    {row.campaign_key}
                                                </span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="max-w-[10rem]">
                                            <span
                                                className="block w-32 truncate text-xs text-muted-foreground"
                                                title={row.template_id === null || row.template_id === undefined ? "No template" : (templateNames.get(row.template_id) ?? "Unknown template")}
                                            >
                                                {row.template_id === null || row.template_id === undefined
                                                    ? "No template"
                                                    : (templateNames.get(row.template_id) ?? "Unknown template")}
                                            </span>
                                        </TableCell>
                                        <TableCell className="max-w-[12rem]">
                                            <span className="block w-40 truncate text-xs text-muted-foreground" title={names.join(", ")}>
                                                {names.length > 0 ? `${names.slice(0, 2).join(", ")}${names.length > 2 ? ` +${names.length - 2} more` : ""}` : "No groups"}
                                            </span>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex min-w-0 flex-col gap-1">
                                                <CampaignStatusBadge status={row.status} />
                                                {isScheduled && row.scheduled_at ? (
                                                    <span className="whitespace-nowrap text-[11px] tabular-nums text-muted-foreground" title={row.scheduled_at}>
                                                        Sends {formatPHT(row.scheduled_at)}
                                                    </span>
                                                ) : null}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            {row.total_count > 0 ? (
                                                <div className="flex min-w-28 flex-col gap-1">
                                                    <Progress value={progressPercent(row.sent_count, row.total_count)} />
                                                    <span className="text-[11px] tabular-nums text-muted-foreground">
                                                        {row.sent_count} of {row.total_count} sent
                                                    </span>
                                                </div>
                                            ) : (
                                                <span className="text-xs text-muted-foreground">
                                                    {isDraft ? "Not queued yet" : "No recipients"}
                                                </span>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <span className="whitespace-nowrap text-xs text-muted-foreground">
                                                {formatPHT(row.created_at)}
                                            </span>
                                        </TableCell>
                                        <TableCell className="sticky right-0 bg-card">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button
                                                        aria-label={`Actions for campaign ${row.campaign_name}`}
                                                        className="h-8 w-8"
                                                        disabled={rowBusy}
                                                        onClick={(event) => event.stopPropagation()}
                                                        size="icon"
                                                        variant="ghost"
                                                    >
                                                        {rowBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreVertical className="h-4 w-4" />}
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" className="w-[200px]">
                                                    {canSendNow ? (
                                                        <DropdownMenuItem disabled={rowBusy} onSelect={() => openQueue(row)}>
                                                            Send now
                                                        </DropdownMenuItem>
                                                    ) : null}
                                                    {canResend ? (
                                                        <DropdownMenuItem disabled={rowBusy} onSelect={() => openQueue(row)}>
                                                            Send again
                                                        </DropdownMenuItem>
                                                    ) : null}
                                                    {canSchedule ? (
                                                        <DropdownMenuItem disabled={rowBusy} onSelect={() => openSchedule(row)}>
                                                            {isScheduled ? "Reschedule send" : "Schedule send"}
                                                        </DropdownMenuItem>
                                                    ) : null}
                                                    {canUnschedule ? (
                                                        <DropdownMenuItem disabled={rowBusy} onSelect={() => void handleUnschedule(row)}>
                                                            Unschedule
                                                        </DropdownMenuItem>
                                                    ) : null}
                                                    {isDraft ? (
                                                        <DropdownMenuItem disabled={rowBusy} onSelect={() => setFormTarget({ mode: "edit", row })}>
                                                            Edit draft
                                                        </DropdownMenuItem>
                                                    ) : null}
                                                    {canTest ? (
                                                        <DropdownMenuItem
                                                            disabled={rowBusy}
                                                            onSelect={() => {
                                                                clearOutcome();
                                                                setTestTarget(row);
                                                                setTestResult(null);
                                                                setTestError(null);
                                                            }}
                                                        >
                                                            Test send
                                                        </DropdownMenuItem>
                                                    ) : null}
                                                    {canSendNow || canResend || isDraft || canTest ? <DropdownMenuSeparator /> : null}
                                                    {canCancel ? (
                                                        <DropdownMenuItem
                                                            className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                                                            disabled={rowBusy}
                                                            onSelect={() => setDangerTarget({ kind: "cancel", row })}
                                                        >
                                                            Cancel send
                                                        </DropdownMenuItem>
                                                    ) : null}
                                                    {canDelete ? (
                                                        <DropdownMenuItem
                                                            className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                                                            disabled={rowBusy}
                                                            onSelect={() => setDangerTarget({ kind: "delete", row })}
                                                        >
                                                            Delete
                                                        </DropdownMenuItem>
                                                    ) : null}
                                                    {!hasActions ? (
                                                        <DropdownMenuItem disabled>No actions available</DropdownMenuItem>
                                                    ) : null}
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                    {total > 0 ? (
                        <MsPager
                            page={query.page}
                            pageSize={query.limit}
                            totalPages={totalPages}
                            total={total}
                            rangeStart={rangeStart}
                            rangeEnd={rangeEnd}
                            onPage={(next) => setQuery({ page: next })}
                            onPageSize={(size) => setQuery({ limit: size, page: 1 })}
                        />
                    ) : null}
                </div>
            ) : null}

            <CampaignFormDialog
                busy={formBusy}
                groups={groups}
                initial={formTarget?.row ?? null}
                key={formTarget === null ? "form-closed" : `${formTarget.mode}:${formTarget.row?.id ?? "new"}`}
                lookupsLoading={lookupsLoading}
                mode={formTarget?.mode ?? "create"}
                open={formTarget !== null}
                templates={templates}
                onOpenChange={(open) => {
                    if (!open) setFormTarget(null);
                }}
                onSubmit={handleFormSubmit}
            />

            <CampaignQueueDialog
                counts={queueCounts}
                campaign={queueTarget}
                error={queueTarget ? queueError ?? actionError : null}
                expanding={queueExpanding}
                loadingCounts={queueBusy}
                open={queueTarget !== null}
                onConfirm={() => void handleExpand()}
                onOpenChange={(open) => {
                    if (!open) {
                        setQueueTarget(null);
                        setQueueCounts(null);
                        setQueueError(null);
                    }
                }}
            />

            <CampaignScheduleDialog
                busy={scheduleBusy}
                campaign={scheduleTarget}
                counts={scheduleCounts}
                error={scheduleTarget ? scheduleError ?? actionError : null}
                key={scheduleTarget === null ? "schedule-closed" : `schedule:${scheduleTarget.id}:${scheduleNonce}`}
                loadingCounts={scheduleCountsBusy}
                open={scheduleTarget !== null}
                onClose={() => {
                    setScheduleTarget(null);
                    setScheduleCounts(null);
                    setScheduleError(null);
                }}
                onConfirm={(scheduledAt) => void handleScheduleConfirm(scheduledAt)}
            />

            <CampaignDangerDialog
                busy={dangerBusy}
                busyLabel={dangerTarget?.kind === "cancel" ? "Cancelling…" : "Deleting…"}
                confirmLabel={dangerTarget?.kind === "cancel" ? "Cancel send" : "Delete campaign"}
                description={
                    dangerTarget?.kind === "cancel"
                        ? `This stops “${dangerTarget.row.campaign_name}” — pending sends are skipped. Already delivered mail cannot be recalled.`
                        : `This permanently deletes “${dangerTarget?.row.campaign_name ?? "this campaign"}” and its per-recipient send record. This cannot be undone.`
                }
                open={dangerTarget !== null}
                title={dangerTarget?.kind === "cancel" ? "Cancel this send?" : "Delete this campaign?"}
                onConfirm={() => void handleDangerConfirm()}
                onOpenChange={(open) => {
                    if (!open) setDangerTarget(null);
                }}
            />

            <CampaignTestSendDialog
                busy={testBusy}
                campaign={testTarget}
                error={testTarget ? testError ?? actionError : null}
                key={testTarget === null ? "test-closed" : `test:${testTarget.id}`}
                open={testTarget !== null}
                result={testTarget && testResult ? testResult : null}
                onOpenChange={(open) => {
                    if (!open) {
                        setTestTarget(null);
                        setTestResult(null);
                        setTestError(null);
                    }
                }}
                onSend={handleTestSend}
            />
        </section>
    );
}
