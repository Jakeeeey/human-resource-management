"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Applicant, Quiz } from "../types";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, UserPlus, CheckCircle2 } from "lucide-react";

interface ApplicantIntakeDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    quiz: Quiz | null;
}

// "search": look up an existing applicant -- the quick-retake shortcut, still
// goes straight to the quiz, no form. "placeholder": confirm + hand over the
// device. A brand-new applicant is NOT created here anymore -- "New Applicant"
// routes into the full Application Form instead (architecture sec 18 decision
// 2: the form is the normal front door; this dialog's own quick-create stays
// retired, this search-and-select path is the one still-alive fallback).
type Step = "search" | "placeholder";

export function ApplicantIntakeDialog({ open, onOpenChange, quiz }: ApplicantIntakeDialogProps) {
    const router = useRouter();
    const [step, setStep] = useState<Step>("search");
    const [search, setSearch] = useState("");
    const [results, setResults] = useState<Applicant[]>([]);
    const [priorAttemptCount, setPriorAttemptCount] = useState(0);
    const [isSearching, setIsSearching] = useState(false);
    const [selectedApplicant, setSelectedApplicant] = useState<Applicant | null>(null);

    useEffect(() => {
        if (!open) {
            setStep("search");
            setSearch("");
            setResults([]);
            setPriorAttemptCount(0);
            setSelectedApplicant(null);
        }
    }, [open]);

    useEffect(() => {
        if (!open || step !== "search" || !search.trim()) {
            setResults([]);
            setPriorAttemptCount(0);
            return;
        }
        const handle = setTimeout(async () => {
            setIsSearching(true);
            try {
                const res = await fetch(
                    `/api/hrm/quiz-file-management/applicant?search=${encodeURIComponent(search.trim())}`
                );
                const data = await res.json();
                setResults(data.applicants || []);
                setPriorAttemptCount(data.priorAttemptCount || 0);
            } catch {
                setResults([]);
                setPriorAttemptCount(0);
            } finally {
                setIsSearching(false);
            }
        }, 300);
        return () => clearTimeout(handle);
    }, [search, open, step]);

    const handleSelectExisting = (applicant: Applicant) => {
        setSelectedApplicant(applicant);
        setStep("placeholder");
    };

    const handleNewApplicant = () => {
        onOpenChange(false);
        router.push(`/hrm/application-form?quiz_id=${quiz?.id}`);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[480px]">
                {step === "search" ? (
                    <>
                        <DialogHeader>
                            <DialogTitle>Start Quiz: {quiz?.name}</DialogTitle>
                            <DialogDescription>
                                Look up the applicant who&apos;s about to retake this quiz, or
                                start a new application if they&apos;re not in the system yet.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-3">
                            <div className="relative">
                                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search applicant by name..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    className="pl-8"
                                    autoFocus
                                />
                            </div>

                            {isSearching && (
                                <p className="text-sm text-muted-foreground">Searching...</p>
                            )}

                            {!isSearching && search.trim() && results.length > 0 && (
                                <ScrollArea className="max-h-[200px] rounded-md border">
                                    <div className="p-1">
                                        {results.map((applicant) => (
                                            <button
                                                key={applicant.id}
                                                type="button"
                                                onClick={() => handleSelectExisting(applicant)}
                                                className="w-full rounded-sm px-3 py-2 text-left text-sm hover:bg-muted"
                                            >
                                                <div className="font-medium">{applicant.full_name}</div>
                                                {applicant.position_applied_for && (
                                                    <div className="text-xs text-muted-foreground">
                                                        {applicant.position_applied_for}
                                                    </div>
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                </ScrollArea>
                            )}

                            {!isSearching && search.trim() && results.length === 0 && (
                                <p className="text-sm text-muted-foreground">
                                    No matches found under this name.
                                </p>
                            )}

                            {!isSearching && priorAttemptCount > 0 && (
                                <p className="text-xs text-muted-foreground">
                                    ⓘ {priorAttemptCount} prior attempt(s) found under this name
                                </p>
                            )}

                            <Button
                                type="button"
                                variant="outline"
                                className="w-full"
                                onClick={handleNewApplicant}
                            >
                                <UserPlus className="mr-2 h-4 w-4" />
                                New Applicant
                            </Button>
                        </div>

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                                Cancel
                            </Button>
                        </DialogFooter>
                    </>
                ) : (
                    <>
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                                <CheckCircle2 className="h-5 w-5 text-green-600" />
                                Ready to Hand Over
                            </DialogTitle>
                            <DialogDescription>
                                Hand the device to the applicant now to begin.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="rounded-lg border p-4 space-y-2 text-sm">
                            <div>
                                <span className="text-muted-foreground">Quiz: </span>
                                <span className="font-medium">{quiz?.name}</span>
                            </div>
                            <div>
                                <span className="text-muted-foreground">Applicant: </span>
                                <span className="font-medium">{selectedApplicant?.full_name}</span>
                            </div>
                            {selectedApplicant?.position_applied_for && (
                                <div>
                                    <span className="text-muted-foreground">Position: </span>
                                    <span className="font-medium">
                                        {selectedApplicant.position_applied_for}
                                    </span>
                                </div>
                            )}
                        </div>

                        <DialogFooter>
                            <Button
                                type="button"
                                onClick={() => {
                                    onOpenChange(false);
                                    router.push(
                                        `/apply/quiz?quiz_id=${quiz?.id}&applicant_id=${selectedApplicant?.id}`
                                    );
                                }}
                            >
                                Hand Over Device
                            </Button>
                        </DialogFooter>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}
