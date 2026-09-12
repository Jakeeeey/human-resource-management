"use client";

import * as React from "react";
import { HoverCard as HoverCardPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";

// Module-local copy of src/components/ui/hover-card.tsx:22-40 (ui/* is
// PROTECTED — copy, never edit). Powers var-token docs on hover.

/**
 * Hover root for var-token docs.
 * @returns The hover-card root.
 */
function MailHoverCard({
    ...props
}: React.ComponentProps<typeof HoverCardPrimitive.Root>) {
    return <HoverCardPrimitive.Root data-slot="mail-hover-card" {...props} />;
}

/**
 * Hover trigger (wraps the {{var}} chip).
 * @returns The hover-card trigger.
 */
function MailHoverCardTrigger({
    ...props
}: React.ComponentProps<typeof HoverCardPrimitive.Trigger>) {
    return <HoverCardPrimitive.Trigger data-slot="mail-hover-card-trigger" {...props} />;
}

interface MailVarDocsProps {
    varName: string;
    friendlyName: string;
    children: React.ReactNode;
}

/**
 * Var-docs wrapper: hovering a {{token}} chip shows its fill-in docs.
 * @param varName - Exact snake_case token name.
 * @param friendlyName - HR-facing label.
 * @param children - The chip trigger.
 * @returns The chip wrapped in hover docs.
 */
function MailVarDocs({ varName, friendlyName, children }: MailVarDocsProps) {
    return (
        <MailHoverCard>
            <MailHoverCardTrigger asChild>{children}</MailHoverCardTrigger>
            <MailHoverCardContent>
                <p className="truncate text-sm font-medium" title={`{{${varName}}}`}>
                    {`{{${varName}}}`}
                </p>
                <p className="truncate text-sm text-muted-foreground" title={friendlyName}>
                    {friendlyName}
                </p>
                <p className="text-xs text-muted-foreground">
                    Fills in by itself when the email sends. Leave blank to send
                    it empty.
                </p>
            </MailHoverCardContent>
        </MailHoverCard>
    );
}

/**
 * Hover-card popover content.
 * @param className - Extra classes.
 * @returns The hover-card content.
 */
function MailHoverCardContent({
    className,
    align = "center",
    sideOffset = 4,
    ...props
}: React.ComponentProps<typeof HoverCardPrimitive.Content>) {
    return (
        <HoverCardPrimitive.Portal data-slot="mail-hover-card-portal">
            <HoverCardPrimitive.Content
                data-slot="mail-hover-card-content"
                align={align}
                sideOffset={sideOffset}
                className={cn(
                    "bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 w-64 origin-(--radix-hover-card-content-transform-origin) rounded-md border p-4 shadow-md outline-hidden",
                    className
                )}
                {...props}
            />
        </HoverCardPrimitive.Portal>
    );
}

export { MailHoverCard, MailHoverCardTrigger, MailHoverCardContent, MailVarDocs };
