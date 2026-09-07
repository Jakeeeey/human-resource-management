"use client";

import { useState } from "react";
import { Mail } from "lucide-react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { MailBindingsManager } from "./MailBindingsManager";
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
    const [sendNowBinding, setSendNowBinding] = useState<MailBindingRow | null>(null);

    return (
        <div className="grid gap-4 p-2 sm:p-6 md:p-10">
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
            <Tabs defaultValue="templates" className="grid gap-4">
                <TabsList className="justify-start">
                    <TabsTrigger value="templates">Templates</TabsTrigger>
                    <TabsTrigger value="bindings">Bindings</TabsTrigger>
                    <TabsTrigger value="outbox">Outbox</TabsTrigger>
                </TabsList>
                <TabsContent value="templates">
                    <MailTemplateList />
                </TabsContent>
                <TabsContent value="bindings">
                    <MailBindingsManager onSendNow={setSendNowBinding} />
                </TabsContent>
                <TabsContent value="outbox">
                    <MailOutboxViewer />
                </TabsContent>
            </Tabs>
            <MailSendNowDialog binding={sendNowBinding} onClose={() => setSendNowBinding(null)} />
        </div>
    );
}
