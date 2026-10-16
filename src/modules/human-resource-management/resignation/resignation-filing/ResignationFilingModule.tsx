"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Inbox, RefreshCw, UserSearch } from "lucide-react";
import { OptionCombobox } from "./components/OptionCombobox";
import { ResignationAttachmentDialog } from "./components/ResignationAttachmentDialog";
import { ResignationFilingForm } from "./components/ResignationFilingForm";
import { ResignationFilingStatusPanel, eligibilityReasonMessage } from "./components/ResignationFilingStatusPanel";
import { ResignationStatusCard } from "./components/ResignationStatusCard";
import { useResignationFiling } from "./hooks/useResignationFiling";
import { ResignationFilingProvider } from "./providers/ResignationFilingProvider";

const PROCESS_STEPS: ReadonlyArray<{ title: string; detail: string }> = [
    { title: "Submit", detail: "Record the resignation and its effectivity date." },
    { title: "HR acknowledgement", detail: "HR records that the resignation notice was received." },
    { title: "Clearance", detail: "The employee works through the clearance checklist." },
];

export default function ResignationFilingModule() {
    return (
        <ResignationFilingProvider>
            <ResignationFilingContent />
        </ResignationFilingProvider>
    );
}

function ResignationFilingContent() {
    const {
        employees,
        isLoadingEmployees,
        employeesError,
        selectedUserId,
        selectedEmployee,
        selectEmployee,
        filings,
        eligibility,
        total,
        isLoading,
        error,
        refresh,
        previewFiling,
        openPreview,
        closePreview,
    } = useResignationFiling();

    const canFile = eligibility !== null && eligibility.canFile;
    const currentStatus = filings.length > 0 ? filings[0].status : null;
    const blockedMessage = eligibilityReasonMessage(eligibility);
    const isRefreshing = isLoading || isLoadingEmployees;

    return (
        <div className="mx-auto min-h-screen max-w-[1600px] space-y-6 p-2 sm:p-6 md:p-10">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h2 className="text-xl font-bold tracking-tight">Resignation Filing</h2>
                    <p className="text-sm text-muted-foreground">
                        Record a resignation on behalf of an employee. Filed resignations are reviewed in Resignation
                        Acknowledgement.
                    </p>
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => void refresh()}
                    disabled={isRefreshing}
                >
                    <RefreshCw className={isRefreshing ? "h-4 w-4 animate-spin" : "h-4 w-4"} aria-hidden="true" />
                    Refresh
                </Button>
            </div>

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] items-start">
                <div className="min-w-0 space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Employee</CardTitle>
                            <CardDescription>Search an active employee.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {isLoadingEmployees ? (
                                <Skeleton className="h-9 w-full max-w-md" />
                            ) : employeesError ? (
                                <Alert variant="destructive">
                                    <AlertTitle>Employee list unavailable</AlertTitle>
                                    <AlertDescription className="space-y-3">
                                        <p>{employeesError}</p>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => void refresh()}
                                            disabled={isRefreshing}
                                        >
                                            <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
                                            Retry
                                        </Button>
                                    </AlertDescription>
                                </Alert>
                            ) : employees.length === 0 ? (
                                <p className="text-xs text-muted-foreground">No employees are available to file for.</p>
                            ) : (
                                <OptionCombobox
                                    id="resignation-employee"
                                    options={employees.map((employee) => ({
                                        value: String(employee.user_id),
                                        label: employee.full_name,
                                    }))}
                                    value={selectedUserId === null ? null : String(selectedUserId)}
                                    onChange={(next) => selectEmployee(next === null ? null : Number(next))}
                                    placeholder="Select an employee..."
                                    searchPlaceholder="Search employees…"
                                    emptyText="No employees match this search."
                                />
                            )}
                        </CardContent>
                    </Card>

                    {selectedEmployee === null ? (
                        <div className="rounded-xl border border-dashed bg-muted/20 p-6 sm:p-8">
                            <div className="flex items-start gap-3">
                                <UserSearch
                                    className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground"
                                    aria-hidden="true"
                                />
                                <div className="min-w-0 space-y-1">
                                    <p className="text-sm font-semibold">No employee selected</p>
                                    <p className="text-sm text-muted-foreground">
                                        Pick an employee to check whether they can be filed for and to record the
                                        resignation.
                                    </p>
                                </div>
                            </div>
                        </div>
                    ) : isLoading ? (
                        <div className="space-y-4">
                            <Skeleton className="h-32 w-full rounded-xl" />
                            <Skeleton className="h-64 w-full rounded-xl" />
                        </div>
                    ) : error ? (
                        <Alert variant="destructive">
                            <AlertTitle>Filing details unavailable</AlertTitle>
                            <AlertDescription className="space-y-3">
                                <p>{error}</p>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => void refresh()}
                                    disabled={isRefreshing}
                                >
                                    <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
                                    Retry
                                </Button>
                            </AlertDescription>
                        </Alert>
                    ) : (
                        <>
                            <ResignationFilingStatusPanel
                                employeeName={selectedEmployee.full_name}
                                status={currentStatus}
                                eligibility={eligibility}
                            />
                            {canFile ? (
                                <Card>
                                    <CardHeader>
                                        <CardTitle>New resignation filing</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <ResignationFilingForm key={selectedUserId} />
                                    </CardContent>
                                </Card>
                            ) : (
                                <Card>
                                    <CardHeader>
                                        <CardTitle>Cannot file for this employee</CardTitle>
                                        <CardDescription>
                                            {blockedMessage === ""
                                                ? "No new resignation filing can be recorded right now."
                                                : blockedMessage}
                                        </CardDescription>
                                    </CardHeader>
                                </Card>
                            )}
                            <div className="space-y-3">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <h3 className="text-base font-semibold tracking-tight">
                                        {"This employee's filings"}
                                    </h3>
                                    <p className="text-sm text-muted-foreground tabular-nums">
                                        Showing <span className="font-semibold">{filings.length}</span> of{" "}
                                        <span className="font-semibold">{total}</span>{" "}
                                        {total === 1 ? "filing" : "filings"}
                                    </p>
                                </div>
                                {filings.length === 0 ? (
                                    <Card>
                                        <CardContent className="flex items-center justify-center gap-3 py-6 text-center">
                                            <Inbox
                                                className="h-5 w-5 shrink-0 text-muted-foreground"
                                                aria-hidden="true"
                                            />
                                            <p className="text-sm text-muted-foreground">
                                                No resignation filings recorded for this employee yet.
                                            </p>
                                        </CardContent>
                                    </Card>
                                ) : (
                                    <div className="space-y-3">
                                        {filings.map((filing) => (
                                            <ResignationStatusCard
                                                key={filing.id ?? `${filing.resignation_date}-${filing.filed_at}`}
                                                filing={filing}
                                                onPreview={openPreview}
                                            />
                                        ))}
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>

                <div className="lg:sticky lg:top-4">
                    <Card className="bg-muted/40">
                        <CardHeader>
                            <CardTitle className="text-base">Process</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <ol className="space-y-3">
                                {PROCESS_STEPS.map((step, index) => (
                                    <li key={step.title} className="flex items-start gap-3">
                                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border bg-card text-xs font-bold tabular-nums">
                                            {index + 1}
                                        </span>
                                        <span className="min-w-0">
                                            <span className="block text-sm font-semibold">{step.title}</span>
                                            <span className="block text-xs text-muted-foreground">{step.detail}</span>
                                        </span>
                                    </li>
                                ))}
                            </ol>
                            <p className="border-t pt-4 text-xs text-muted-foreground">
                                Filed resignations are reviewed in Resignation Acknowledgement.
                            </p>
                        </CardContent>
                    </Card>
                </div>
            </div>

            <ResignationAttachmentDialog open={previewFiling !== null} filing={previewFiling} onClose={closePreview} />
        </div>
    );
}
