"use client";

import { useEffect, useMemo, useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { OptionCombobox } from "./OptionCombobox";
import { toast } from "sonner";
import { formatPHT } from "../utils/time";
import { useClearanceHubContext } from "../providers/ClearanceHubProvider";
import type { ApprovableResignation, ClearanceHubTemplate } from "../hooks/useClearanceHub";

interface AssignClearanceDialogProps {
    isOpen: boolean;
    onClose: () => void;
}

function suggestTemplateId(
    resignation: ApprovableResignation,
    templates: ClearanceHubTemplate[]
): number | null {
    if (resignation.department_id !== null) {
        const departmentMatch = templates.find(
            (template) => template.department_id === resignation.department_id
        );
        if (departmentMatch) return departmentMatch.id;
    }
    const globalFallback = templates.find((template) => template.department_id === null);
    return globalFallback ? globalFallback.id : null;
}

export function AssignClearanceDialog({ isOpen, onClose }: AssignClearanceDialogProps) {
    const {
        templates,
        templatesError,
        resignations,
        resignationsError,
        assignClearance,
    } = useClearanceHubContext();

    const [resignationValue, setResignationValue] = useState("");
    const [templateValue, setTemplateValue] = useState("");
    const [manualTemplate, setManualTemplate] = useState(false);
    const [suggestedId, setSuggestedId] = useState<number | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            setResignationValue("");
            setTemplateValue("");
            setManualTemplate(false);
            setSuggestedId(null);
            setSubmitError(null);
            setIsSubmitting(false);
        }
    }, [isOpen]);

    const eligibleResignations = useMemo(
        () => resignations.filter((resignation) => !resignation.has_clearance),
        [resignations]
    );

    const resignationOptions = useMemo(
        () =>
            eligibleResignations.map((resignation) => ({
                value: String(resignation.id),
                label:
                    resignation.department_name !== null
                        ? `${resignation.employee_name} · ${resignation.department_name}`
                        : resignation.employee_name,
            })),
        [eligibleResignations]
    );

    const templateOptions = useMemo(
        () =>
            templates.map((template) => ({
                value: String(template.id),
                label: template.title,
            })),
        [templates]
    );

    const selectedResignation = useMemo(
        () => eligibleResignations.find((resignation) => String(resignation.id) === resignationValue) ?? null,
        [eligibleResignations, resignationValue]
    );

    const handleResignationChange = (value: string) => {
        setResignationValue(value);
        setSubmitError(null);
        const resignation = eligibleResignations.find((entry) => String(entry.id) === value) ?? null;
        if (!resignation) {
            setSuggestedId(null);
            return;
        }
        const suggestion = suggestTemplateId(resignation, templates);
        setSuggestedId(suggestion);
        if (!manualTemplate && suggestion !== null) {
            setTemplateValue(String(suggestion));
        }
    };

    const handleTemplateChange = (value: string) => {
        setTemplateValue(value);
        setManualTemplate(true);
        setSubmitError(null);
    };

    const handleSubmit = async () => {
        const resignationId = Number(resignationValue);
        const templateId = Number(templateValue);
        if (!Number.isInteger(resignationId) || resignationId <= 0) {
            setSubmitError("Choose a resignation to continue");
            return;
        }
        if (!Number.isInteger(templateId) || templateId <= 0) {
            setSubmitError("Choose a template to continue");
            return;
        }
        setIsSubmitting(true);
        setSubmitError(null);
        try {
            const message = await assignClearance(resignationId, templateId);
            toast.success(message);
            onClose();
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "Failed to assign clearance";
            setSubmitError(errorMessage);
            toast.error(errorMessage);
        } finally {
            setIsSubmitting(false);
        }
    };

    const loadError = resignationsError ?? templatesError;

    return (
        <Dialog open={isOpen} onOpenChange={(next) => { if (!next) onClose(); }}>
            <DialogContent className="sm:max-w-125 data-[state=closed]:duration-100 data-[state=open]:duration-150">
                <DialogHeader>
                    <DialogTitle>Assign Clearance</DialogTitle>
                    <DialogDescription>
                        Pick an approved resignation and the template to copy onto it
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                    {loadError && (
                        <Alert variant="destructive">
                            <AlertDescription>{loadError}</AlertDescription>
                        </Alert>
                    )}

                    <div className="grid gap-2">
                        <Label>Approved resignation</Label>
                        <OptionCombobox
                            options={resignationOptions}
                            value={resignationValue}
                            onValueChange={handleResignationChange}
                            placeholder="Select resignation..."
                            disabled={isSubmitting || eligibleResignations.length === 0}
                        />
                        {selectedResignation && (
                            <p className="text-xs text-muted-foreground">
                                Filed {formatPHT(selectedResignation.filed_at)}
                            </p>
                        )}
                        {!loadError && eligibleResignations.length === 0 && (
                            <p className="text-xs text-muted-foreground">
                                No approved resignations are waiting for a clearance. Every approved
                                resignation already has one.
                            </p>
                        )}
                    </div>

                    <div className="grid gap-2">
                        <Label>Template</Label>
                        <OptionCombobox
                            options={templateOptions}
                            value={templateValue}
                            onValueChange={handleTemplateChange}
                            placeholder="Select template..."
                            disabled={isSubmitting || templates.length === 0}
                        />
                        {!loadError && templates.length === 0 && (
                            <p className="text-xs text-muted-foreground">
                                No templates are available. Create one in Clearance Templates first.
                            </p>
                        )}
                        {selectedResignation && suggestedId === null && templates.length > 0 && (
                            <p className="text-xs text-muted-foreground">
                                No department match for this resignation. Choose a template manually.
                            </p>
                        )}
                        {suggestedId !== null && !manualTemplate && templateValue === String(suggestedId) && (
                            <p className="text-xs text-muted-foreground">
                                Auto-suggested from the employee&apos;s department. You may choose a different template.
                            </p>
                        )}
                    </div>

                    {submitError && (
                        <Alert variant="destructive">
                            <AlertDescription>{submitError}</AlertDescription>
                        </Alert>
                    )}
                </div>

                <DialogFooter>
                    <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
                        Cancel
                    </Button>
                    <Button
                        type="button"
                        onClick={handleSubmit}
                        disabled={isSubmitting || resignationValue === "" || templateValue === ""}
                    >
                        {isSubmitting ? "Assigning..." : "Assign"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
