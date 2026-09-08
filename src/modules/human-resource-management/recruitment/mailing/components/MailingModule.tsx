"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Mail, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { MailBindingsManager } from "./MailBindingsManager";
import { MailManualSend } from "./MailManualSend";
import { MailOutboxViewer } from "./MailOutboxViewer";
import { MailSendNowDialog } from "./MailSendNowDialog";
import { MailTemplateList } from "./MailTemplateList";
import type { MailBindingRow } from "../providers/mailBindingService";

/**
 * Mailing module root: templates CRUD + bindings manager (+ manual Send-now
 * applicant picker, todo 12) + outbox viewer.
 * @returns The tabbed module.
 */
export function MailingModule() {
    const [tab, setTab] = useState("templates");
    const router = useRouter();
    const [sendNowBinding, setSendNowBinding] = useState<MailBindingRow | null>(null);

    const handleTabChange = (next: string) => {
        setTab(next);
    };

    return (
        <div className="grid gap-4 p-2 sm:p-6 md:p-10">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-primary/10 rounded-2xl">
                        <Mail className="h-6 w-6 text-primary" />
                    </div>
                    <div className="grid gap-1">
                        <h1 className="text-2xl font-semibold sm:text-4xl">Mailing</h1>
                        <p className="text-base text-muted-foreground sm:text-lg">
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
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <TabsList className="justify-start">
                        <TabsTrigger value="templates">Templates</TabsTrigger>
                        <TabsTrigger value="bindings">Bindings</TabsTrigger>
                        <TabsTrigger value="send">Compose</TabsTrigger>
                        <TabsTrigger value="outbox">Outbox</TabsTrigger>
                    </TabsList>
                    {tab === "templates" && (
                        <Button className="w-full sm:w-auto" onClick={() => router.push("/hrm/mailing/templates/new")}>
                            New template
                        </Button>
                    )}
                </div>
                <TabsContent value="templates" forceMount hidden={tab !== "templates"}>
                    <MailTemplateList />
                </TabsContent>
                <TabsContent value="bindings" forceMount hidden={tab !== "bindings"}>
                    <MailBindingsManager onSendNow={setSendNowBinding} />
                </TabsContent>
                <TabsContent value="send" forceMount hidden={tab !== "send"}>
                    <MailManualSend />
                </TabsContent>
                <TabsContent value="outbox" forceMount hidden={tab !== "outbox"}>
                    <MailOutboxViewer />
                </TabsContent>
            </Tabs>
            <MailSendNowDialog binding={sendNowBinding} onClose={() => setSendNowBinding(null)} />
        </div>
    );
}
