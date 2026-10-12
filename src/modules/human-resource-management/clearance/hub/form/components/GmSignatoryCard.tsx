"use client";

import type { JSX } from "react";
import { UserCheck } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface GmSignatoryCardProps {
    gmName: string;
    gmTitle: string;
    onNameChange: (value: string) => void;
    onTitleChange: (value: string) => void;
    disabled: boolean;
}

export function GmSignatoryCard({
    gmName,
    gmTitle,
    onNameChange,
    onTitleChange,
    disabled,
}: GmSignatoryCardProps): JSX.Element {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                    <UserCheck className="h-4 w-4" aria-hidden="true" />
                    General Manager
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="grid gap-3 sm:grid-cols-2">
                    <div className="grid gap-1.5">
                        <Label htmlFor="clearance-gm-name">GM Name</Label>
                        <Input
                            id="clearance-gm-name"
                            aria-label="GM name"
                            value={gmName}
                            disabled={disabled}
                            maxLength={120}
                            placeholder="General manager name"
                            onChange={(event) => onNameChange(event.target.value)}
                        />
                    </div>
                    <div className="grid gap-1.5">
                        <Label htmlFor="clearance-gm-title">GM Title</Label>
                        <Input
                            id="clearance-gm-title"
                            aria-label="GM title"
                            value={gmTitle}
                            disabled={disabled}
                            maxLength={120}
                            placeholder="General manager title"
                            onChange={(event) => onTitleChange(event.target.value)}
                        />
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
