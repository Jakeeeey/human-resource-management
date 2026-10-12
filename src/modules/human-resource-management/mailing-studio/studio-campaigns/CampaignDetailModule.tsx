"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Loader2, RefreshCw, SearchX } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

import { CampaignStatusBadge } from "./components/CampaignStatusBadge";
import { MsPager } from "./components/MsPager";
import {
    getCampaign,
    listCampaignDeliveries,
    type CampaignDeliveryRow,
} from "./providers/campaignsClient";
import type { MsCampaignRow } from "./types";
import { formatPHT } from "./utils/time";

const DELIVERIES_PAGE_SIZE = 25;

const DELIVERY_TONES: Record<string, string> = {
    queued: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
    sending: "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-400",
    sent: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
    failed: "border-destructive/40 bg-destructive/10 text-destructive",
    skipped: "border-border bg-muted text-muted-foreground",
};

function deliveryTone(status: string): string {
    return DELIVERY_TONES[status] ?? "border-border bg-muted text-muted-foreground";
}

function deliveryLabel(status: string): string {
    return status === "" ? "Unknown" : status[0].toUpperCase() + status.slice(1);
}

function toMessage(cause: unknown): string {
    return cause instanceof Error ? cause.message : String(cause);
}

interface CampaignDetailModuleProps {
    readonly campaignId: number;
    readonly initialCampaign: MsCampaignRow;
}

export function CampaignDetailModule({ campaignId, initialCampaign }: CampaignDetailModuleProps) {
    const [campaign, setCampaign] = useState<MsCampaignRow>(initialCampaign);
    const [rows, setRows] = useState<CampaignDeliveryRow[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(DELIVERIES_PAGE_SIZE);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(
        async (targetPage: number, targetLimit: number): Promise<void> => {
            setIsLoading(true);
            setError(null);
            try {
                const [fresh, result] = await Promise.all([
                    getCampaign(campaignId),
                    listCampaignDeliveries(campaignId, { page: targetPage, limit: targetLimit }),
                ]);
                setCampaign(fresh);
                setRows(result.rows);
                setTotal(result.total);
                setPage(result.page);
                setLimit(result.limit);
            } catch (cause) {
                setError(toMessage(cause));
            } finally {
                setIsLoading(false);
            }
        },
        [campaignId]
    );

    useEffect(() => {
        void load(1, DELIVERIES_PAGE_SIZE);
    }, [load]);

    const totalPages = Math.max(1, Math.ceil(total / limit));
    const rangeStart = total === 0 || rows.length === 0 ? 0 : (page - 1) * limit + 1;
    const rangeEnd = rows.length === 0 ? 0 : (page - 1) * limit + rows.length;

    return (
        <section aria-label="Campaign detail" className="flex min-h-0 flex-1 flex-col gap-4">
            <div className="flex items-start gap-3">
                <Button aria-label="Back to campaigns" asChild className="h-8 w-8 shrink-0" size="icon" variant="ghost">
                    <Link href="/hrm/mailing-studio/studio-campaigns">
                        <ArrowLeft className="h-4 w-4" />
                    </Link>
                </Button>
                <div className="min-w-0 flex-1">
                    <h1 className="truncate text-lg font-semibold tracking-tight" title={campaign.campaign_name}>
                        {campaign.campaign_name}
                    </h1>
                    <p className="truncate font-mono text-xs text-muted-foreground">{campaign.campaign_key}</p>
                </div>
                <Button
                    aria-label="Refresh campaign detail"
                    className="min-h-11 md:min-h-0"
                    disabled={isLoading}
                    size="sm"
                    variant="outline"
                    onClick={() => void load(page, limit)}
                >
                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    Refresh
                </Button>
            </div>

            <div className="rounded-lg border bg-card p-4">
                <div className="flex flex-wrap items-center gap-3">
                    <CampaignStatusBadge status={campaign.status} />
                    <span className="text-xs text-muted-foreground">Created {formatPHT(campaign.created_at)}</span>
                    {campaign.scheduled_at ? (
                        <span className="text-xs text-muted-foreground">Scheduled {formatPHT(campaign.scheduled_at)}</span>
                    ) : null}
                    {campaign.started_at ? (
                        <span className="text-xs text-muted-foreground">Started {formatPHT(campaign.started_at)}</span>
                    ) : null}
                    {campaign.finished_at ? (
                        <span className="text-xs text-muted-foreground">Finished {formatPHT(campaign.finished_at)}</span>
                    ) : null}
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
                    <div className="rounded-lg border bg-muted px-2 py-2">
                        <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Total</dt>
                        <dd className="text-lg font-semibold tabular-nums">{campaign.total_count}</dd>
                    </div>
                    <div className="rounded-lg border bg-emerald-500/10 px-2 py-2">
                        <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Sent</dt>
                        <dd className="text-lg font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
                            {campaign.sent_count}
                        </dd>
                    </div>
                    <div className="rounded-lg border bg-destructive/10 px-2 py-2">
                        <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Failed</dt>
                        <dd className="text-lg font-semibold tabular-nums text-destructive">{campaign.failed_count}</dd>
                    </div>
                    <div className="rounded-lg border bg-muted px-2 py-2">
                        <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Skipped</dt>
                        <dd className="text-lg font-semibold tabular-nums">{campaign.skipped_count}</dd>
                    </div>
                </dl>
            </div>

            {error ? (
                <div className="rounded-lg border border-destructive/40 bg-card p-4" role="alert">
                    <p className="text-sm text-destructive">{error}</p>
                    <Button className="mt-2 min-h-11 md:min-h-0" size="sm" variant="outline" onClick={() => void load(page, limit)}>
                        Retry
                    </Button>
                </div>
            ) : null}

            {!isLoading && !error && total === 0 ? (
                <div className="flex flex-col items-center gap-2 rounded-lg border bg-card px-4 py-16 text-center">
                    <SearchX aria-hidden="true" className="size-8 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">No per-recipient records yet.</p>
                </div>
            ) : null}

            {rows.length > 0 ? (
                <div className="overflow-hidden rounded-lg border bg-card">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Recipient</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Attempts</TableHead>
                                <TableHead>Error</TableHead>
                                <TableHead>Sent</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {rows.map((row) => (
                                <TableRow key={String(row.id)}>
                                    <TableCell className="max-w-[16rem]">
                                        <span className="block truncate font-mono text-xs" title={row.to_email}>
                                            {row.to_email === "" ? "—" : row.to_email}
                                        </span>
                                    </TableCell>
                                    <TableCell>
                                        <Badge className={deliveryTone(row.status)} variant="outline">
                                            {deliveryLabel(row.status)}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="tabular-nums">{row.attempts}</TableCell>
                                    <TableCell className="max-w-[18rem]">
                                        {row.error ? (
                                            <span className="block truncate text-xs text-destructive" title={row.error}>
                                                {row.error}
                                            </span>
                                        ) : (
                                            <span className="text-xs text-muted-foreground">—</span>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <span className="whitespace-nowrap text-xs text-muted-foreground">
                                            {formatPHT(row.sent_at ?? row.published_at)}
                                        </span>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                    {total > 0 ? (
                        <MsPager
                            page={page}
                            pageSize={limit}
                            totalPages={totalPages}
                            total={total}
                            rangeStart={rangeStart}
                            rangeEnd={rangeEnd}
                            onPage={(next) => void load(next, limit)}
                            onPageSize={(size) => void load(1, size)}
                        />
                    ) : null}
                </div>
            ) : null}
        </section>
    );
}
