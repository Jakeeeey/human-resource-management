"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Mail, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { mailOutboxStatusSchema, type MailOutboxStatus } from "../types/mail-outbox.schema";
import { useMailTemplates } from "../hooks/useMailTemplates";
import { MailCombobox } from "./MailCombobox";

import { MailBindingsManager } from "./MailBindingsManager";
import { MailManualSend } from "./MailManualSend";
import { MailOutboxViewer } from "./MailOutboxViewer";
import { MailSendNowDialog } from "./MailSendNowDialog";
import { MailTemplateList } from "./MailTemplateList";
import type { MailBindingRow } from "../providers/mailBindingService";

const STATUS_OPTIONS = [
    { value: "", label: "All statuses" },
    ...mailOutboxStatusSchema.options.map((status) => ({ value: status, label: status })),
];

/**
 * Mailing module root: templates CRUD + bindings manager (+ manual Send-now
 * applicant picker, todo 12) + outbox viewer.
 * @returns The tabbed module.
 */
export function MailingModule() {
    const [tab, setTab] = useState("outbox");
    const router = useRouter();
    const [sendNowBinding, setSendNowBinding] = useState<MailBindingRow | null>(null);

    // Outbox filter state lives here so the filter bar can sit on the tabs
    // row; the viewer receives values + setters as props.
    const [outboxStatus, setOutboxStatus] = useState<MailOutboxStatus | "">("");
    const [outboxTemplate, setOutboxTemplate] = useState("");
    const [outboxQuery, setOutboxQuery] = useState("");
    const { templates } = useMailTemplates();

    const templateOptions = useMemo(
        () => [
            { value: "", label: "All templates" },
            ...templates.map((template) => ({
                value: String(template.id),
                label: template.template_name,
            })),
        ],
        [templates],
    );

    const handleTabChange = (next: string) => {
        setTab(next);
    };

    return (
        <div className="grid gap-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
                        <Mail className="size-4" aria-hidden="true" />
                    </div>
                    <div className="grid min-w-0 gap-0.5">
                        <h1 className="truncate text-xl font-semibold">Mailing</h1>
                        <p className="truncate text-sm text-muted-foreground">
                            Email templates, per-event send rules, and the mail log.
                        </p>
                    </div>
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    className="w-full sm:w-auto"
                    onClick={() => window.dispatchEvent(new CustomEvent("mailing:refresh"))}
                    aria-label="Refresh mailing data"
                    title="Refresh mailing data"
                >
                    <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
                    Refresh
                </Button>
            </div>
            <Tabs value={tab} onValueChange={handleTabChange} className="grid gap-4">
                <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                    <TabsList className="justify-start group-data-[orientation=horizontal]/tabs:h-auto">
                        <TabsTrigger value="outbox" className="text-base max-sm:min-h-[44px] data-[state=active]:bg-primary/10 data-[state=active]:text-primary">Outbox</TabsTrigger>
                        <TabsTrigger value="send" className="text-base max-sm:min-h-[44px] data-[state=active]:bg-primary/10 data-[state=active]:text-primary">Compose</TabsTrigger>
                        <TabsTrigger value="templates" className="text-base max-sm:min-h-[44px] data-[state=active]:bg-primary/10 data-[state=active]:text-primary">Templates</TabsTrigger>
                        <TabsTrigger value="bindings" className="text-base max-sm:min-h-[44px] data-[state=active]:bg-primary/10 data-[state=active]:text-primary">Bindings</TabsTrigger>
                    </TabsList>
                    {tab === "templates" && (
                        <Button size="sm" className="w-full sm:w-auto" onClick={() => router.push("/hrm/mailing/templates/new")}>
                            New template
                        </Button>
                    )}
                    {tab === "outbox" && (
                        <div className="grid gap-2 sm:grid-cols-3 lg:w-[560px] lg:shrink-0">
                            <MailCombobox
                                options={STATUS_OPTIONS}
                                value={outboxStatus}
                                onValueChange={(v) => setOutboxStatus(v as MailOutboxStatus | "")}
                                placeholder="All statuses"
                            />
                            <MailCombobox
                                options={templateOptions}
                                value={outboxTemplate}
                                onValueChange={setOutboxTemplate}
                                placeholder="All templates"
                            />
                            <Input
                                aria-label="Search recipient or email"
                                title="Search recipient or email"
                                value={outboxQuery}
                                onChange={(event) => setOutboxQuery(event.target.value)}
                                placeholder="Recipient or email…"
                                className="h-8 text-xs"
                            />
                        </div>
                    )}
                </div>
                <TabsContent value="outbox" forceMount hidden={tab !== "outbox"}>
                    <MailOutboxViewer
                        status={outboxStatus}
                        templateFilter={outboxTemplate}
                        query={outboxQuery}
                        templates={templates}
                        onClearFilters={() => {
                            setOutboxStatus("");
                            setOutboxTemplate("");
                            setOutboxQuery("");
                        }}
                    />
                </TabsContent>
                <TabsContent value="send" forceMount hidden={tab !== "send"}>
                    <MailManualSend />
                </TabsContent>
                <TabsContent value="templates" forceMount hidden={tab !== "templates"}>
                    <MailTemplateList />
                </TabsContent>
                <TabsContent value="bindings" forceMount hidden={tab !== "bindings"}>
                    <MailBindingsManager onSendNow={setSendNowBinding} />
                </TabsContent>
            </Tabs>
            <MailSendNowDialog binding={sendNowBinding} onClose={() => setSendNowBinding(null)} />
        </div>
    );
}
