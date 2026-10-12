"use client";

import { useEffect, useRef, useState } from "react";
import { toPng } from "html-to-image";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { EmployeeIdCombobox } from "./employeeIdCombobox";
import type { User } from "../types";
import { EmployeeIdCardSide } from "./employeeIdCard";
import {
    EMPLOYEE_ID_IMAGE_PLACEHOLDER,
    type EmployeeIdDoc,
    employeeIdExportFilename,
    parseEmployeeIdDoc,
} from "./employeeIdTemplate";
import { buildEmployeeIdValues } from "./employeeIdValues";

interface EmployeeIdTabProps {
    readonly user: User;
}

type EmployeeIdStatus = "loading" | "unavailable" | "empty" | "corrupt" | "ready";

type EmployeeIdResolvedKind = "empty" | "corrupt" | "ready";

interface EmployeeIdOption {
    readonly id: number;
    readonly name: string;
}

const RESOLVED_OVERRIDE = "resolved";

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readIdOptions(payload: unknown): EmployeeIdOption[] {
    if (!isRecord(payload)) return [];
    if (!Array.isArray(payload.data)) return [];
    const options: EmployeeIdOption[] = [];
    for (const entry of payload.data) {
        if (!isRecord(entry)) continue;
        if (entry.is_active === false || entry.is_active === 0) continue;
        if (typeof entry.id !== "number" || typeof entry.name !== "string") continue;
        options.push({ id: entry.id, name: entry.name });
    }
    return options;
}

export function EmployeeIdTab({ user }: EmployeeIdTabProps) {
    const frontRef = useRef<HTMLDivElement>(null);
    const backRef = useRef<HTMLDivElement>(null);
    const [status, setStatus] = useState<EmployeeIdStatus>("loading");
    const [doc, setDoc] = useState<EmployeeIdDoc | null>(null);
    const [resolvedDoc, setResolvedDoc] = useState<EmployeeIdDoc | null>(null);
    const [resolvedKind, setResolvedKind] = useState<EmployeeIdResolvedKind>("empty");
    const [templateName, setTemplateName] = useState<string>("");
    const [resolvedName, setResolvedName] = useState<string>("");
    const [values, setValues] = useState<Record<string, string>>({});
    const [options, setOptions] = useState<EmployeeIdOption[]>([]);
    const [overrideId, setOverrideId] = useState<string>(RESOLVED_OVERRIDE);
    const [overrideBusy, setOverrideBusy] = useState<boolean>(false);
    const [exporting, setExporting] = useState<"front" | "back" | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [reloadKey, setReloadKey] = useState<number>(0);

    useEffect(() => {
        let cancelled = false;
        async function load(): Promise<void> {
            setStatus("loading");
            setNotice(null);
            setOverrideId(RESOLVED_OVERRIDE);
            try {
                const res = await fetch(`/api/hrm/id-layout/resolve?user_id=${user.id}`);
                if (!res.ok) throw new Error("resolve request failed");
                const payload: unknown = await res.json();
                if (!isRecord(payload)) throw new Error("resolve payload invalid");
                const row = isRecord(payload.user) ? payload.user : {};
                const company = isRecord(payload.company) ? payload.company : null;
                if (!cancelled) setValues(buildEmployeeIdValues(user, row, company));
                const template = payload.template;
                if (template === null) {
                    if (!cancelled) {
                        setDoc(null);
                        setResolvedDoc(null);
                        setResolvedKind("empty");
                        setTemplateName("");
                        setResolvedName("");
                        setStatus("empty");
                    }
                    return;
                }
                if (!isRecord(template)) throw new Error("template payload invalid");
                const name = typeof template.name === "string" && template.name !== "" ? template.name : "ID template";
                const parsed = parseEmployeeIdDoc(template.design_json);
                if (parsed === null) {
                    if (!cancelled) {
                        setDoc(null);
                        setResolvedDoc(null);
                        setResolvedKind("corrupt");
                        setTemplateName(name);
                        setResolvedName(name);
                        setStatus("corrupt");
                    }
                    return;
                }
                if (!cancelled) {
                    setDoc(parsed);
                    setResolvedDoc(parsed);
                    setResolvedKind("ready");
                    setTemplateName(name);
                    setResolvedName(name);
                    setStatus("ready");
                }
            } catch {
                if (!cancelled) setStatus("unavailable");
            }
            try {
                const listRes = await fetch("/api/hrm/id-layout/templates?page=1");
                if (!listRes.ok) return;
                const listPayload: unknown = await listRes.json();
                if (!cancelled) setOptions(readIdOptions(listPayload));
            } catch {
                return;
            }
        }
        void load();
        return () => {
            cancelled = true;
        };
    }, [user, reloadKey]);

    async function handleOverride(value: string): Promise<void> {
        setOverrideId(value);
        setNotice(null);
        if (value === RESOLVED_OVERRIDE) {
            setDoc(resolvedDoc);
            setTemplateName(resolvedName);
            setStatus(resolvedKind);
            return;
        }
        setOverrideBusy(true);
        try {
            const res = await fetch(`/api/hrm/id-layout/templates/${value}`);
            if (!res.ok) throw new Error("template request failed");
            const row: unknown = await res.json();
            const design = isRecord(row) ? row.design_json : null;
            const parsed = parseEmployeeIdDoc(design);
            if (parsed === null) {
                toast.error("That ID template could not be displayed.");
                setNotice("That ID template could not be displayed.");
                setOverrideId(RESOLVED_OVERRIDE);
                return;
            }
            const name = isRecord(row) && typeof row.name === "string" && row.name !== "" ? row.name : "ID template";
            setDoc(parsed);
            setTemplateName(name);
            setStatus("ready");
        } catch {
            toast.error("Could not load that ID template. Please try again.");
            setNotice("Could not load that ID template. Please try again.");
            setOverrideId(RESOLVED_OVERRIDE);
        } finally {
            setOverrideBusy(false);
        }
    }

    async function exportSide(side: "front" | "back"): Promise<void> {
        const target = side === "front" ? frontRef.current : backRef.current;
        if (!target || !doc) return;
        setExporting(side);
        setNotice(null);
        try {
            const dataUrl = await toPng(target, {
                pixelRatio: 2,
                cacheBust: true,
                imagePlaceholder: EMPLOYEE_ID_IMAGE_PLACEHOLDER,
                style: {
                    transform: "none",
                    boxShadow: "none",
                    borderRadius: "0",
                },
            });
            const link = document.createElement("a");
            link.download = employeeIdExportFilename(side, user.firstName, user.lastName);
            link.href = dataUrl;
            link.click();
        } catch {
            toast.error("ID export failed. Please try again.");
            setNotice("ID export failed. Please try again.");
        } finally {
            setExporting(null);
        }
    }

    const frontPage = doc ? doc.pages.find((page) => page.side === "front") : undefined;
    const backPage = doc ? doc.pages.find((page) => page.side === "back") : undefined;
    const canRender = status === "ready" && doc !== null && frontPage !== undefined && backPage !== undefined;
    const busy = exporting !== null || overrideBusy;

    return (
        <div className="flex flex-col gap-6 animate-in fade-in duration-300">
            <div className="flex flex-col gap-2 rounded-2xl border border-border/50 bg-background p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-col gap-1">
                    <span className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">Template</span>
                    <span className="text-sm font-medium">{templateName !== "" ? templateName : "No template resolved"}</span>
                    <span className="text-xs text-muted-foreground">Preview only. Changing this does not reassign the employee template.</span>
                </div>
                <EmployeeIdCombobox
                    value={overrideId}
                    onValueChange={(value) => void handleOverride(value)}
                    placeholder="Resolved template"
                    disabled={options.length === 0 || overrideBusy || status === "loading"}
                    className="w-[240px]"
                    options={[
                        { value: RESOLVED_OVERRIDE, label: "Resolved template" },
                        ...options.map((option) => ({ value: String(option.id), label: option.name })),
                    ]}
                />
            </div>

            {notice !== null && (
                <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                    {notice}
                </div>
            )}

            {status === "loading" && (
                <div className="flex min-h-[400px] items-center justify-center rounded-2xl bg-muted/20 text-sm text-muted-foreground">
                    Loading ID template…
                </div>
            )}

            {status === "unavailable" && (
                <div className="flex min-h-[400px] flex-col items-center justify-center gap-4 rounded-2xl bg-muted/20 px-6 text-center">
                    <p className="text-sm font-medium">The ID service is currently unavailable. Please try again later.</p>
                    <Button onClick={() => setReloadKey((key) => key + 1)} variant="outline" className="h-11 rounded-xl">
                        Retry
                    </Button>
                </div>
            )}

            {status === "empty" && (
                <div className="flex min-h-[400px] flex-col items-center justify-center gap-4 rounded-2xl bg-muted/20 px-6 text-center">
                    <p className="text-sm font-medium">No ID template is available for this employee.</p>
                    <p className="text-xs text-muted-foreground">Ask HR to assign a company template or set a default template.</p>
                    <div className="flex gap-3">
                        <Button variant="outline" className="h-11 w-[200px] rounded-xl" disabled>
                            <Download className="h-4 w-4" />
                            Export Front
                        </Button>
                        <Button variant="outline" className="h-11 w-[200px] rounded-xl" disabled>
                            <Download className="h-4 w-4" />
                            Export Back
                        </Button>
                    </div>
                </div>
            )}

            {status === "corrupt" && (
                <div className="flex min-h-[400px] flex-col items-center justify-center gap-4 rounded-2xl bg-muted/20 px-6 text-center">
                    <p className="text-sm font-medium">This ID template could not be displayed.</p>
                    <p className="text-xs text-muted-foreground">The template data is invalid. Ask HR to review the template.</p>
                    <div className="flex gap-3">
                        <Button variant="outline" className="h-11 w-[200px] rounded-xl" disabled>
                            <Download className="h-4 w-4" />
                            Export Front
                        </Button>
                        <Button variant="outline" className="h-11 w-[200px] rounded-xl" disabled>
                            <Download className="h-4 w-4" />
                            Export Back
                        </Button>
                    </div>
                </div>
            )}

            {canRender && doc !== null && frontPage !== undefined && backPage !== undefined && (
                <div className="flex flex-col gap-8 rounded-2xl bg-muted/20 py-6 md:flex-row md:items-start md:justify-center">
                    <div className="flex flex-col items-center gap-6">
                        <div className="relative group" style={{ perspective: "1000px" }}>
                            <div className="mb-2 text-center text-sm font-semibold uppercase tracking-widest text-muted-foreground">Front</div>
                            <div
                                ref={frontRef}
                                className="transition-transform duration-300 group-hover:shadow-2xl"
                                style={{
                                    width: "408px",
                                    height: "648px",
                                    position: "relative",
                                    overflow: "hidden",
                                    boxShadow: "0 10px 25px rgba(0,0,0,0.1)",
                                    borderRadius: "12px",
                                    backgroundColor: "white",
                                    flexShrink: 0,
                                }}
                            >
                                <EmployeeIdCardSide page={frontPage} nodes={doc.nodes} values={values} />
                            </div>
                        </div>
                        <Button
                            onClick={() => void exportSide("front")}
                            disabled={busy}
                            variant="outline"
                            className="mt-2 h-11 w-[200px] gap-2 rounded-xl border-primary/20 transition-all hover:border-primary hover:bg-primary/5"
                        >
                            <Download className="h-4 w-4" />
                            {exporting === "front" ? "Exporting…" : "Export Front"}
                        </Button>
                    </div>

                    <div className="flex flex-col items-center gap-6">
                        <div className="relative group" style={{ perspective: "1000px" }}>
                            <div className="mb-2 text-center text-sm font-semibold uppercase tracking-widest text-muted-foreground">Back</div>
                            <div
                                ref={backRef}
                                className="transition-transform duration-300 group-hover:shadow-2xl"
                                style={{
                                    width: "408px",
                                    height: "648px",
                                    position: "relative",
                                    overflow: "hidden",
                                    boxShadow: "0 10px 25px rgba(0,0,0,0.1)",
                                    borderRadius: "12px",
                                    backgroundColor: "white",
                                    flexShrink: 0,
                                }}
                            >
                                <EmployeeIdCardSide page={backPage} nodes={doc.nodes} values={values} />
                            </div>
                        </div>
                        <Button
                            onClick={() => void exportSide("back")}
                            disabled={busy}
                            variant="outline"
                            className="mt-2 h-11 w-[200px] gap-2 rounded-xl border-primary/20 transition-all hover:border-primary hover:bg-primary/5"
                        >
                            <Download className="h-4 w-4" />
                            {exporting === "back" ? "Exporting…" : "Export Back"}
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
