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
import { toast } from "sonner";

interface ApplicantIntakeDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    quiz: Quiz | null;
}

type Step = "search" | "create" | "placeholder";

export function ApplicantIntakeDialog({ open, onOpenChange, quiz }: ApplicantIntakeDialogProps) {
    const router = useRouter();
    const [step, setStep] = useState<Step>("search");
    const [search, setSearch] = useState("");
    const [results, setResults] = useState<Applicant[]>([]);
    const [priorAttemptCount, setPriorAttemptCount] = useState(0);
    const [isSearching, setIsSearching] = useState(false);
    const [newName, setNewName] = useState("");
    const [newPosition, setNewPosition] = useState("");
    const [isCreating, setIsCreating] = useState(false);
    const [selectedApplicant, setSelectedApplicant] = useState<Applicant | null>(null);

    useEffect(() => {
        if (!open) {
            setStep("search");
            setSearch("");
            setResults([]);
            setPriorAttemptCount(0);
            setNewName("");
            setNewPosition("");
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

    const handleCreate = async () => {
        if (!newName.trim()) {
            toast.error("Full name is required");
            return;
        }
        setIsCreating(true);
        try {
            const res = await fetch("/api/hrm/quiz-file-management/applicant", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    full_name: newName.trim(),
                    position_applied_for: newPosition.trim() || null,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed to create applicant");
            setSelectedApplicant(data.data);
            setStep("placeholder");
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to create applicant");
        } finally {
            setIsCreating(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[480px]">
                {step !== "placeholder" ? (
                    <>
                        <DialogHeader>
                            <DialogTitle>Start Quiz: {quiz?.name}</DialogTitle>
                            <DialogDescription>
                                Look up the applicant who&apos;s about to take this quiz, or
                                add them if they&apos;re not in the system yet.
                            </DialogDescription>
                        </DialogHeader>

                        {step === "search" && (
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
                                    onClick={() => {
                                        setNewName(search);
                                        setStep("create");
                                    }}
                                >
                                    <UserPlus className="mr-2 h-4 w-4" />
                                    New Applicant
                                </Button>
                            </div>
                        )}

                        {step === "create" && (
                            <div className="space-y-3">
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium">Full Name</label>
                                    <Input
                                        placeholder="e.g. Juan Dela Cruz"
                                        value={newName}
                                        onChange={(e) => setNewName(e.target.value)}
                                        autoFocus
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium">Position Applied For</label>
                                    <Input
                                        placeholder="e.g. Warehouse Associate"
                                        value={newPosition}
                                        onChange={(e) => setNewPosition(e.target.value)}
                                    />
                                </div>
                            </div>
                        )}

                        <DialogFooter>
                            {step === "create" && (
                                <Button type="button" variant="ghost" onClick={() => setStep("search")}>
                                    Back
                                </Button>
                            )}
                            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                                Cancel
                            </Button>
                            {step === "create" && (
                                <Button type="button" onClick={handleCreate} disabled={isCreating}>
                                    {isCreating ? "Creating..." : "Create & Continue"}
                                </Button>
                            )}
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
                                        `/hrm/quiz-file-management/quiz-taking?quiz_id=${quiz?.id}&applicant_id=${selectedApplicant?.id}`
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
