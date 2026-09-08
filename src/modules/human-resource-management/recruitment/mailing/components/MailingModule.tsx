"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Mail } from "lucide-react";

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
 *
 * Send-Test deep-link: the Templates tab kebab navigates here with
 * `?template=<id>`. A render-phase consume reads that query once, switches
 * to the Send tab with the id as the composer initial template, and a
 * strip effect removes the query so later mounts start blank. An unknown id
 * passes through and the composer treats it as no-preselect (no matching
 * template row).
 * @returns The tabbed module.
 */
export function MailingModule() {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const [tab, setTab] = useState("templates");
    const [sendTemplateId, setSendTemplateId] = useState<string | undefined>(undefined);
    const [consumedParam, setConsumedParam] = useState<string | null>(null);
    const [sendNowBinding, setSendNowBinding] = useState<MailBindingRow | null>(null);

    // Render-phase consume (documented derived-state pattern, not an effect):
    // a fresh `?template=` switches to Send with the id as composer initial.
    // Resetting the guard when the query is gone keeps repeat Send Tests working.
    const preselectParam = searchParams.get("template");
    if (preselectParam && preselectParam !== consumedParam) {
        setConsumedParam(preselectParam);
        setSendTemplateId(preselectParam);
        setTab("send");
    }
    if (!preselectParam && consumedParam !== null) {
        setConsumedParam(null);
    }

    // External sync only: strip the consumed query so later mounts start blank.
    useEffect(() => {
        if (preselectParam) router.replace(pathname);
    }, [preselectParam, router, pathname]);

    const handleTabChange = (next: string) => {
        setTab(next);
        if (next !== "send") setSendTemplateId(undefined);
    };

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
            <Tabs value={tab} onValueChange={handleTabChange} className="grid gap-4">
                <TabsList className="justify-start">
                    <TabsTrigger value="templates">Templates</TabsTrigger>
                    <TabsTrigger value="bindings">Bindings</TabsTrigger>
                    <TabsTrigger value="send">Send</TabsTrigger>
                    <TabsTrigger value="outbox">Outbox</TabsTrigger>
                </TabsList>
                <TabsContent value="templates">
                    <MailTemplateList />
                </TabsContent>
                <TabsContent value="bindings">
                    <MailBindingsManager onSendNow={setSendNowBinding} />
                </TabsContent>
                <TabsContent value="send">
                    <MailManualSend initialTemplateId={sendTemplateId} />
                </TabsContent>
                <TabsContent value="outbox">
                    <MailOutboxViewer />
                </TabsContent>
            </Tabs>
            <MailSendNowDialog binding={sendNowBinding} onClose={() => setSendNowBinding(null)} />
        </div>
    );
}
