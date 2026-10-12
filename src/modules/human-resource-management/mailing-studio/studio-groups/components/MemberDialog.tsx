"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Ban, Building2, Check, CheckCheck, Loader2, Users, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

import {
    addMsGroupMembers,
    checkMsGroupMembers,
    fetchMsDirectoryCustomers,
    fetchMsDirectoryEmployees,
    selectAllMsGroupMembers,
    type MsAddGroupMembersResult,
    type MsCustomerOption,
    type MsEmployeeOption,
    type MsNewGroupMember,
} from "../providers/msGroupsClient";
import { GROUP_SOURCE_KIND_LABELS, type GroupSourceKind, type MsGroupMemberRow } from "../types";

interface MemberDialogProps {
    readonly groupId: number;
    readonly groupName: string;
    readonly open: boolean;
    readonly onOpenChange: (open: boolean) => void;
    readonly existingMembers: readonly MsGroupMemberRow[];
    readonly onSaved: (result: MsAddGroupMembersResult) => void;
}

type PickerTab = "employee" | "customer" | "manual";

interface PickedMember {
    readonly key: string;
    readonly kind: GroupSourceKind;
    readonly ref: number | null;
    readonly email: string;
    readonly label: string;
}

const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const DIRECTORY_PAGE_SIZE = 10;
const SEARCH_DEBOUNCE_MS = 400;

function normalizeEmail(value: string): string {
    return value.trim().toLowerCase();
}

function takenEmails(members: readonly MsGroupMemberRow[]): Set<string> {
    const taken = new Set<string>();
    for (const member of members) taken.add(normalizeEmail(member.email));
    return taken;
}

function takenRefs(members: readonly MsGroupMemberRow[]): Set<string> {
    const taken = new Set<string>();
    for (const member of members) {
        if (member.source_ref !== null && member.source_ref !== undefined) {
            taken.add(`${member.source_kind}:${member.source_ref}`);
        }
    }
    return taken;
}

function isAdded(
    kind: GroupSourceKind,
    ref: number,
    email: string | null,
    emails: Set<string>,
    refs: Set<string>
): boolean {
    if (refs.has(`${kind}:${ref}`)) return true;
    return email !== null && emails.has(email);
}

export function MemberDialog({ groupId, groupName, open, onOpenChange, existingMembers, onSaved }: MemberDialogProps) {
    const [tab, setTab] = useState<PickerTab>("employee");
    const [search, setSearch] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [page, setPage] = useState(1);
    const [employees, setEmployees] = useState<MsEmployeeOption[]>([]);
    const [customers, setCustomers] = useState<MsCustomerOption[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [selection, setSelection] = useState<readonly PickedMember[]>([]);
    const [reloadToken, setReloadToken] = useState(0);
    const [checkedEmails, setCheckedEmails] = useState<readonly string[]>([]);
    const [checkedRefs, setCheckedRefs] = useState<readonly string[]>([]);
    const [manualText, setManualText] = useState("");
    const [manualError, setManualError] = useState<string | null>(null);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [selectAllBusy, setSelectAllBusy] = useState(false);

    const emailsTaken = useMemo(() => {
        const taken = takenEmails(existingMembers);
        for (const email of checkedEmails) taken.add(email);
        return taken;
    }, [existingMembers, checkedEmails]);
    const refsTaken = useMemo(() => {
        const taken = takenRefs(existingMembers);
        for (const ref of checkedRefs) taken.add(ref);
        return taken;
    }, [existingMembers, checkedRefs]);
    const selectedKeys = useMemo(() => new Set(selection.map((entry) => entry.key)), [selection]);
    const directoryTab = tab === "manual" ? null : tab;
    const alreadyAddedForTab =
        directoryTab === null ? 0 : existingMembers.filter((member) => member.source_kind === directoryTab).length;
    const selectAllCount = directoryTab === null ? 0 : Math.max(0, total - alreadyAddedForTab);
    const selectAllVisible = directoryTab !== null && !loading && total > 0 && selectAllCount > 0;

    useEffect(() => {
        if (!open) return;
        setTab("employee");
        setSearch("");
        setDebouncedSearch("");
        setPage(1);
        setEmployees([]);
        setCustomers([]);
        setTotal(0);
        setCheckedEmails([]);
        setCheckedRefs([]);
        setLoadingMore(false);
        setLoadError(null);
        setSelection([]);
        setManualText("");
        setManualError(null);
        setSubmitError(null);
        setBusy(false);
        setSelectAllBusy(false);
    }, [open]);

    useEffect(() => {
        if (!open) return;
        const timer = window.setTimeout(() => {
            setDebouncedSearch(search.trim());
            setPage(1);
            setEmployees([]);
            setCustomers([]);
            setTotal(0);
            setCheckedEmails([]);
            setCheckedRefs([]);
        }, SEARCH_DEBOUNCE_MS);
        return () => window.clearTimeout(timer);
    }, [search, open]);

    useEffect(() => {
        if (!open || tab === "manual") return;
        let live = true;
        if (page <= 1) {
            setLoading(true);
        } else {
            setLoadingMore(true);
        }
        setLoadError(null);
        if (tab === "employee") {
            fetchMsDirectoryEmployees({ search: debouncedSearch, page, limit: DIRECTORY_PAGE_SIZE }).then(
                (result) => {
                    if (!live) return;
                    setEmployees((current) =>
                        page <= 1
                            ? result.items
                            : [...current, ...result.items.filter((item) => !current.some((existing) => existing.ref === item.ref))]
                    );
                    setTotal(result.total);
                    setLoading(false);
                    setLoadingMore(false);
                    void checkMsGroupMembers(groupId, {
                        emails: result.items
                            .map((item) => item.email)
                            .filter((email): email is string => email !== null),
                        employeeRefs: result.items.map((item) => item.ref),
                    }).then((check) => {
                        if (!live) return;
                        setCheckedEmails((current) => Array.from(new Set([...current, ...check.emailsTaken])));
                        setCheckedRefs((current) => Array.from(new Set([...current, ...check.refsTaken])));
                    }).catch(() => undefined);
                },
                (cause: unknown) => {
                    if (!live) return;
                    setLoadError(cause instanceof Error ? cause.message : String(cause));
                    setLoading(false);
                    setLoadingMore(false);
                }
            );
        } else {
            fetchMsDirectoryCustomers({ search: debouncedSearch, page, limit: DIRECTORY_PAGE_SIZE }).then(
                (result) => {
                    if (!live) return;
                    setCustomers((current) =>
                        page <= 1
                            ? result.items
                            : [...current, ...result.items.filter((item) => !current.some((existing) => existing.ref === item.ref))]
                    );
                    setTotal(result.total);
                    setLoading(false);
                    setLoadingMore(false);
                    void checkMsGroupMembers(groupId, {
                        emails: result.items
                            .map((item) => item.email)
                            .filter((email): email is string => email !== null),
                        customerRefs: result.items.map((item) => item.ref),
                    }).then((check) => {
                        if (!live) return;
                        setCheckedEmails((current) => Array.from(new Set([...current, ...check.emailsTaken])));
                        setCheckedRefs((current) => Array.from(new Set([...current, ...check.refsTaken])));
                    }).catch(() => undefined);
                },
                (cause: unknown) => {
                    if (!live) return;
                    setLoadError(cause instanceof Error ? cause.message : String(cause));
                    setLoading(false);
                    setLoadingMore(false);
                }
            );
        }
        return () => {
            live = false;
        };
    }, [open, tab, debouncedSearch, page, reloadToken, groupId]);

    const maybeLoadMore = (container: HTMLDivElement, loaded: number): void => {
        if (loading || loadingMore || loadError !== null) return;
        if (loaded >= total) return;
        const distance = container.scrollHeight - container.scrollTop - container.clientHeight;
        if (distance < 240) setPage((current) => current + 1);
    };

    const togglePicked = (entry: PickedMember): void => {
        setSubmitError(null);
        setSelection((current) =>
            current.some((item) => item.key === entry.key)
                ? current.filter((item) => item.key !== entry.key)
                : [...current, entry]
        );
    };

    const handleManualAdd = (): void => {
        setManualError(null);
        setSubmitError(null);
        const candidates = manualText
            .split(/[,;\s]+/)
            .map((part) => normalizeEmail(part))
            .filter((part) => part !== "");
        const invalid = candidates.filter((candidate) => !EMAIL_PATTERN.test(candidate));
        if (candidates.length === 0) {
            setManualError("Type or paste at least one email address first.");
            return;
        }
        if (invalid.length > 0) {
            setManualError(
                `${invalid.length} address${invalid.length === 1 ? " is" : "es are"} not valid: ${invalid.slice(0, 3).join(", ")}${invalid.length > 3 ? "…" : ""}`
            );
            return;
        }
        const fresh: PickedMember[] = [];
        for (const candidate of new Set(candidates)) {
            const key = `manual:${candidate}`;
            if (selectedKeys.has(key) || emailsTaken.has(candidate)) continue;
            fresh.push({ key, kind: "manual", ref: null, email: candidate, label: candidate });
        }
        if (fresh.length === 0) {
            setManualError("Those addresses are already selected or already in this group.");
            return;
        }
        setSelection((current) => [...current, ...fresh]);
        setManualText("");
    };

    const handleSubmit = async (): Promise<void> => {
        setSubmitError(null);
        if (selection.length === 0) {
            setSubmitError("Select at least one member first.");
            return;
        }
        const payload: MsNewGroupMember[] = selection.map((entry) =>
            entry.kind === "manual"
                ? { email: entry.email, source_kind: entry.kind }
                : { email: entry.email, source_kind: entry.kind, source_ref: entry.ref }
        );
        setBusy(true);
        try {
            const result = await addMsGroupMembers(groupId, payload);
            onSaved(result);
            onOpenChange(false);
        } catch (cause) {
            setSubmitError(cause instanceof Error ? cause.message : String(cause));
        } finally {
            setBusy(false);
        }
    };

    const handleSelectAll = async (): Promise<void> => {
        if (directoryTab === null || busy || selectAllBusy) return;
        setSubmitError(null);
        setSelectAllBusy(true);
        try {
            const result = await selectAllMsGroupMembers(groupId, {
                sourceKind: directoryTab,
                search: debouncedSearch,
            });
            onSaved(result);
            onOpenChange(false);
        } catch (cause) {
            setSubmitError(cause instanceof Error ? cause.message : String(cause));
        } finally {
            setSelectAllBusy(false);
        }
    };

    const renderResultBar = (): ReactNode => (
        <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground tabular-nums" role="status">
                {total} result{total === 1 ? "" : "s"}
            </p>
            {selectAllVisible ? (
                <Button
                    className="h-7 shrink-0 text-xs"
                    disabled={busy || selectAllBusy}
                    size="sm"
                    type="button"
                    variant="secondary"
                    onClick={() => void handleSelectAll()}
                >
                    {selectAllBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCheck className="h-3.5 w-3.5" />}
                    {selectAllBusy ? "Adding…" : `Select all ${selectAllCount.toLocaleString()} matching`}
                </Button>
            ) : null}
        </div>
    );

    const renderRows = (): ReactNode => {
        const activeItems = tab === "employee" ? employees : customers;
        if (loading && activeItems.length === 0) {
            return (
                <div className="flex flex-col gap-2" role="status" aria-label="Loading people">
                    {[0, 1, 2].map((index) => (
                        <div className="flex items-center gap-3 rounded-lg border bg-card p-3" key={index}>
                            <Skeleton className="h-4 w-4 rounded" />
                            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                                <Skeleton className="h-4 w-1/2" />
                                <Skeleton className="h-3 w-2/3" />
                            </div>
                        </div>
                    ))}
                    <span className="sr-only">Loading people…</span>
                </div>
            );
        }
        if (loadError && activeItems.length === 0) {
            return (
                <div className="rounded-lg border border-destructive/40 bg-card p-4" role="alert">
                    <p className="text-sm text-destructive">{loadError}</p>
                    <Button
                        className="mt-2 min-h-11 md:min-h-0"
                        size="sm"
                        variant="outline"
                        onClick={() => setReloadToken((token) => token + 1)}
                    >
                        Retry
                    </Button>
                </div>
            );
        }
        if (tab === "employee" && employees.length === 0) {
            return (
                <div className="flex flex-col items-center gap-2 rounded-lg border bg-card px-4 py-10 text-center">
                    <Users aria-hidden="true" className="size-8 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                        {debouncedSearch === "" ? "No employees found." : `No employees match “${debouncedSearch}”.`}
                    </p>
                    <p className="text-xs text-muted-foreground">Try a different search.</p>
                </div>
            );
        }
        if (tab === "customer" && customers.length === 0) {
            return (
                <div className="flex flex-col items-center gap-2 rounded-lg border bg-card px-4 py-10 text-center">
                    <Building2 aria-hidden="true" className="size-8 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                        {debouncedSearch === "" ? "No customers found." : `No customers match “${debouncedSearch}”.`}
                    </p>
                    <p className="text-xs text-muted-foreground">Try a different search.</p>
                </div>
            );
        }
        if (tab === "employee") {
            return (
                <ul className="flex flex-col gap-2">
                    {employees.map((option) => {
                        const added = isAdded("employee", option.ref, option.email, emailsTaken, refsTaken);
                        const checked = selectedKeys.has(`employee:${option.ref}`);
                        const disabled = !option.selectable || added;
                        return (
                            <li
                                className="flex items-center gap-3 rounded-lg border bg-card p-3 transition-colors duration-150 hover:border-primary/40"
                                key={option.ref}
                            >
                                <Checkbox
                                    aria-label={`Select ${option.name}`}
                                    checked={added ? true : checked}
                                    disabled={disabled}
                                    onCheckedChange={() => {
                                        if (option.email === null) return;
                                        togglePicked({
                                            key: `employee:${option.ref}`,
                                            kind: "employee",
                                            ref: option.ref,
                                            email: option.email,
                                            label: option.name,
                                        });
                                    }}
                                />
                                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                                    <span className="truncate text-sm font-medium" title={option.name}>
                                        {option.name}
                                    </span>
                                    <span
                                        className="truncate text-xs text-muted-foreground"
                                        title={option.email ?? option.reason ?? ""}
                                    >
                                        {option.email ?? option.reason ?? "No usable email on file"}
                                    </span>
                                </div>
                                {added ? (
                                    <Badge className="border-border bg-muted text-muted-foreground" variant="outline">
                                        <Check className="h-3 w-3" />
                                        Added
                                    </Badge>
                                ) : !option.selectable ? (
                                    <Badge className="border-border bg-muted text-muted-foreground" variant="outline">
                                        <Ban className="h-3 w-3" />
                                        Unavailable
                                    </Badge>
                                ) : null}
                            </li>
                        );
                    })}
                </ul>
            );
        }
        return (
            <ul className="flex flex-col gap-2">
                {customers.map((option) => {
                    const added = isAdded("customer", option.ref, option.email, emailsTaken, refsTaken);
                    const checked = selectedKeys.has(`customer:${option.ref}`);
                    const disabled = !option.selectable || added;
                    const subtitle = option.subtitle ?? (option.active ? null : "Inactive");
                    return (
                        <li
                            className="flex items-center gap-3 rounded-lg border bg-card p-3 transition-colors duration-150 hover:border-primary/40"
                            key={option.ref}
                        >
                            <Checkbox
                                aria-label={`Select ${option.name}`}
                                checked={added ? true : checked}
                                disabled={disabled}
                                onCheckedChange={() => {
                                    if (option.email === null) return;
                                    togglePicked({
                                        key: `customer:${option.ref}`,
                                        kind: "customer",
                                        ref: option.ref,
                                        email: option.email,
                                        label: option.name,
                                    });
                                }}
                            />
                            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                                <span className="truncate text-sm font-medium" title={option.name}>
                                    {option.name}
                                </span>
                                <span
                                    className="truncate text-xs text-muted-foreground"
                                    title={option.email ?? option.reason ?? ""}
                                >
                                    {option.email ?? option.reason ?? "No email on file"}
                                </span>
                                {subtitle ? (
                                    <span className="truncate text-xs text-muted-foreground" title={subtitle}>
                                        {subtitle}
                                    </span>
                                ) : null}
                            </div>
                            {added ? (
                                <Badge className="border-border bg-muted text-muted-foreground" variant="outline">
                                    <Check className="h-3 w-3" />
                                    Added
                                </Badge>
                            ) : !option.selectable ? (
                                <Badge className="border-border bg-muted text-muted-foreground" variant="outline">
                                    <Ban className="h-3 w-3" />
                                    Unavailable
                                </Badge>
                            ) : null}
                        </li>
                    );
                })}
            </ul>
        );
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="flex max-h-[85vh] w-[95vw] flex-col overflow-hidden rounded-2xl p-0 sm:max-w-[640px]">
                <DialogHeader className="px-6 pt-6 text-left">
                    <DialogTitle className="line-clamp-1" title={`Add members to ${groupName}`}>
                        Add members to {groupName}
                    </DialogTitle>
                    <DialogDescription>
                        Pick employees or customers from the directory, or add typed addresses. Linked members stay
                        connected to their source record so re-sync can pick up email changes.
                    </DialogDescription>
                </DialogHeader>
                <div className="flex min-h-0 flex-1 flex-col overflow-hidden" data-testid="member-picker">
                    <Tabs
                        className="flex min-h-0 flex-1 flex-col overflow-hidden px-6 pt-2"
                        value={tab}
                        onValueChange={(next) => {
                            setTab(next as PickerTab);
                            setPage(1);
                            setTotal(0);
                            setCheckedEmails([]);
                            setCheckedRefs([]);
                            if (next === "employee") {
                                setEmployees([]);
                            } else if (next === "customer") {
                                setCustomers([]);
                            }
                            setLoadError(null);
                        }}
                    >
                        <TabsList className="grid w-full grid-cols-3">
                            <TabsTrigger value="employee">Employees</TabsTrigger>
                            <TabsTrigger value="customer">Customers</TabsTrigger>
                            <TabsTrigger value="manual">Manual</TabsTrigger>
                        </TabsList>
                        <TabsContent className="flex min-h-0 flex-1 flex-col overflow-hidden" value="employee">
                            <div
                                className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto py-3"
                                onScroll={(event) => maybeLoadMore(event.currentTarget, employees.length)}
                            >
                                <Input
                                    aria-label="Search employees"
                                    className="h-8 text-xs"
                                    placeholder="Search name or email…"
                                    value={search}
                                    onChange={(event) => setSearch(event.target.value)}
                                />
{renderResultBar()}
                                {renderRows()}
                                {loadingMore && tab === "employee" ? (
                                    <p
                                        className="flex items-center justify-center gap-2 py-3 text-xs text-muted-foreground"
                                        role="status"
                                    >
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                        Loading more…
                                    </p>
                                ) : null}
                                {loadError && employees.length > 0 ? (
                                    <div className="rounded-lg border border-destructive/40 bg-card p-3" role="alert">
                                        <p className="text-xs text-destructive">{loadError}</p>
                                        <Button
                                            className="mt-2 min-h-11 md:min-h-0"
                                            size="sm"
                                            variant="outline"
                                            onClick={() => setReloadToken((token) => token + 1)}
                                        >
                                            Retry
                                        </Button>
                                    </div>
                                ) : null}
                            </div>
                        </TabsContent>
                        <TabsContent className="flex min-h-0 flex-1 flex-col overflow-hidden" value="customer">
                            <div
                                className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto py-3"
                                onScroll={(event) => maybeLoadMore(event.currentTarget, customers.length)}
                            >
                                <Input
                                    aria-label="Search customers"
                                    className="h-8 text-xs"
                                    placeholder="Search name, store, code, or email…"
                                    value={search}
                                    onChange={(event) => setSearch(event.target.value)}
                                />
{renderResultBar()}
                                {renderRows()}
                                {loadingMore && tab === "customer" ? (
                                    <p
                                        className="flex items-center justify-center gap-2 py-3 text-xs text-muted-foreground"
                                        role="status"
                                    >
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                        Loading more…
                                    </p>
                                ) : null}
                                {loadError && customers.length > 0 ? (
                                    <div className="rounded-lg border border-destructive/40 bg-card p-3" role="alert">
                                        <p className="text-xs text-destructive">{loadError}</p>
                                        <Button
                                            className="mt-2 min-h-11 md:min-h-0"
                                            size="sm"
                                            variant="outline"
                                            onClick={() => setReloadToken((token) => token + 1)}
                                        >
                                            Retry
                                        </Button>
                                    </div>
                                ) : null}
                            </div>
                        </TabsContent>
                        <TabsContent className="flex min-h-0 flex-1 flex-col overflow-hidden" value="manual">
                            <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto py-3">
                                <Label className="text-xs font-medium text-muted-foreground" htmlFor="member-manual">
                                    Email addresses
                                </Label>
                                <Textarea
                                    className="min-h-24 text-xs"
                                    id="member-manual"
                                    placeholder={"member@example.com\nanother@example.com"}
                                    spellCheck={false}
                                    value={manualText}
                                    onChange={(event) => setManualText(event.target.value)}
                                />
                                <p className="text-[11px] leading-snug text-muted-foreground">
                                    One per line — commas also work. Manual entries carry no source reference.
                                </p>
                                <div>
                                    <Button
                                        className="min-h-11 md:min-h-0"
                                        size="sm"
                                        type="button"
                                        variant="outline"
                                        onClick={handleManualAdd}
                                    >
                                        Add to selection
                                    </Button>
                                </div>
                                {manualError ? (
                                    <p className="text-xs text-destructive" role="alert">
                                        {manualError}
                                    </p>
                                ) : null}
                            </div>
                        </TabsContent>
                    </Tabs>
                    {selection.length > 0 ? (
                        <div className="border-t px-6 py-3">
                            <div className="flex items-center justify-between gap-2">
                                <p className="text-xs font-medium tabular-nums">
                                    Selected ({selection.length})
                                </p>
                                <Button
                                    className="h-8 text-xs"
                                    size="sm"
                                    type="button"
                                    variant="ghost"
                                    onClick={() => {
                                        setSelection([]);
                                        setSubmitError(null);
                                    }}
                                >
                                    <X className="h-3 w-3" />
                                    Clear all
                                </Button>
                            </div>
                            <ul className="mt-2 flex max-h-24 flex-wrap gap-1.5 overflow-y-auto" aria-label="Selected members">
                                {selection.map((entry) => (
                                    <li key={entry.key}>
                                        <span className="inline-flex max-w-full items-center gap-1 rounded-full border bg-muted py-0.5 pl-2.5 pr-1 text-[11px]">
                                            <span className="min-w-0 truncate" title={`${entry.label} — ${entry.email}`}>
                                                {entry.label} · {GROUP_SOURCE_KIND_LABELS[entry.kind]}
                                            </span>
                                            <button
                                                aria-label={`Remove ${entry.label} from selection`}
                                                className="rounded-full p-0.5 hover:bg-background"
                                                type="button"
                                                onClick={() =>
                                                    setSelection((current) =>
                                                        current.filter((item) => item.key !== entry.key)
                                                    )
                                                }
                                            >
                                                <X className="h-3 w-3" />
                                            </button>
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ) : null}
                    {submitError ? (
                        <p className="px-6 text-xs text-destructive" role="alert">
                            {submitError}
                        </p>
                    ) : null}
                    <DialogFooter className="flex-row justify-end border-t bg-muted/20 px-6 py-4">
                        <DialogClose asChild>
                            <Button className="min-h-11 md:min-h-0" disabled={busy} size="sm" type="button" variant="outline">
                                Cancel
                            </Button>
                        </DialogClose>
                        <Button className="min-h-11 md:min-h-0" disabled={busy || selectAllBusy} size="sm" type="button" onClick={() => void handleSubmit()}>
                            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                            {busy ? "Adding" : selection.length === 0 ? "Add members" : `Add ${selection.length} member${selection.length === 1 ? "" : "s"}`}
                        </Button>
                    </DialogFooter>
                </div>
            </DialogContent>
        </Dialog>
    );
}
