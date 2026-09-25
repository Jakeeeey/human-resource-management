"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { saveDesign } from "../providers/designService";
import { MS_EVENT_KEY_PATTERN } from "../types/ms-catalog.schema";

const TEMPLATE_KEY_HINT = "Lowercase letters, numbers, dots and underscores only (e.g. onboarding.welcome).";

function starterDesignJson(templateName: string): string {
    return JSON.stringify({
        version: 1,
        width: 600,
        nodes: {
            starter: {
                id: "starter",
                parentId: "stage",
                type: "text",
                x: 40,
                y: 36,
                w: 480,
                h: 44,
                rotation: 0,
                z: 1,
                props: {
                    text: templateName,
                    fontFamily: "Arial, Helvetica, sans-serif",
                    fontSize: 14,
                    color: "#1f2937",
                    align: "left",
                },
            },
        },
        rootIds: ["starter"],
    });
}

/**
 * New-template form — the only create path for ms_templates rows. Validates
 * the event-key-shaped template_key client-side (naming the rule), POSTs the
 * templates route with a single-block starter canvas, then navigates to the
 * designer for the new key. The editor itself carries no event selector —
 * event wiring lives on bindings (§7.7).
 */
export function NewTemplateForm() {
    const router = useRouter();
    const [templateKey, setTemplateKey] = useState("");
    const [templateName, setTemplateName] = useState("");
    const [subject, setSubject] = useState("");
    const [formError, setFormError] = useState<string | null>(null);
    const [creating, setCreating] = useState(false);

    const handleCreate = async (): Promise<void> => {
        setFormError(null);
        const key = templateKey.trim();
        if (key.length === 0) {
            setFormError("Template key is required.");
            return;
        }
        if (!MS_EVENT_KEY_PATTERN.test(key)) {
            setFormError(`Template key: ${TEMPLATE_KEY_HINT}`);
            return;
        }
        if (templateName.trim().length === 0) {
            setFormError("Template name is required.");
            return;
        }
        if (subject.trim().length === 0) {
            setFormError("Subject is required.");
            return;
        }
        setCreating(true);
        try {
            const { row } = await saveDesign({
                template_key: key,
                template_name: templateName.trim(),
                subject: subject.trim(),
                design_json: starterDesignJson(templateName.trim()),
            });
            toast.success(`Template ${row.template_key} created — opening the designer.`);
            router.push(`/hrm/mailing-studio?key=${encodeURIComponent(row.template_key)}`);
        } catch (cause) {
            setFormError(cause instanceof Error ? cause.message : String(cause));
        } finally {
            setCreating(false);
        }
    };

    return (
        <section
            aria-label="New template"
            className="mx-auto flex w-full max-w-3xl flex-col gap-3 rounded-lg border bg-card p-4"
            data-testid="new-template-form"
        >
            <h2 className="text-sm font-semibold">New template</h2>
            <p className="text-[11px] leading-relaxed text-muted-foreground">
                Creates the template with a single text block. Open it in the
                designer to lay out content; hook it to events from Bindings.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                    <Label className="text-xs font-medium text-muted-foreground" htmlFor="new-template-key">
                        Template key <span className="text-destructive">*</span>
                    </Label>
                    <Input
                        className="h-8 font-mono text-xs"
                        id="new-template-key"
                        placeholder="onboarding.welcome"
                        spellCheck={false}
                        value={templateKey}
                        onChange={(event) => setTemplateKey(event.target.value)}
                    />
                    <p className="text-[11px] leading-snug text-muted-foreground">{TEMPLATE_KEY_HINT}</p>
                </div>
                <div className="flex flex-col gap-2">
                    <Label className="text-xs font-medium text-muted-foreground" htmlFor="new-template-name">
                        Template name <span className="text-destructive">*</span>
                    </Label>
                    <Input
                        className="h-8 text-xs"
                        id="new-template-name"
                        placeholder="Welcome email"
                        value={templateName}
                        onChange={(event) => setTemplateName(event.target.value)}
                    />
                </div>
                <div className="flex flex-col gap-2 sm:col-span-2">
                    <Label className="text-xs font-medium text-muted-foreground" htmlFor="new-template-subject">
                        Subject <span className="text-destructive">*</span>
                    </Label>
                    <Input
                        className="h-8 text-xs"
                        id="new-template-subject"
                        placeholder="Welcome aboard"
                        value={subject}
                        onChange={(event) => setSubject(event.target.value)}
                    />
                </div>
            </div>
            {formError ? (
                <p className="text-xs text-destructive" role="alert">
                    {formError}
                </p>
            ) : null}
            <div>
                <Button
                    aria-label="Create template"
                    className="min-h-11 md:min-h-0"
                    disabled={creating}
                    size="sm"
                    type="submit"
                    onClick={() => void handleCreate()}
                >
                    {creating ? (
                        <>
                            <Loader2 className="h-4 w-4 animate-spin" /> Creating…
                        </>
                    ) : (
                        "Create template"
                    )}
                </Button>
            </div>
        </section>
    );
}
