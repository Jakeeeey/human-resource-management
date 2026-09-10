"use client";

import * as React from "react";
import { AlertDialog as AlertDialogPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";

// Module-local copy of src/components/ui/alert-dialog.tsx (ui/* is PROTECTED
// — copy, never edit). Discard-draft confirm for the composer. Cancel-then-
// Submit order per QA §3 (Cancel renders first).

/**
 * Confirm-dialog root (controlled open + onOpenChange: the draft-guard
 * intercept point per the Dialog contract).
 * @returns The alert-dialog root.
 */
function MailConfirmDialog({
    ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Root>) {
    return <AlertDialogPrimitive.Root data-slot="mail-confirm-dialog" {...props} />;
}

/**
 * Confirm-dialog content shell.
 * @param className - Extra classes.
 * @returns The centered content.
 */
function MailConfirmDialogContent({
    className,
    ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Content>) {
    return (
        <AlertDialogPrimitive.Portal data-slot="mail-confirm-dialog-portal">
            <AlertDialogPrimitive.Overlay
                data-slot="mail-confirm-dialog-overlay"
                className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/50"
            />
            <AlertDialogPrimitive.Content
                data-slot="mail-confirm-dialog-content"
                className={cn(
                    "bg-background data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 fixed top-[50%] left-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-lg border p-6 shadow-lg duration-200 sm:max-w-lg",
                    className
                )}
                {...props}
            />
        </AlertDialogPrimitive.Portal>
    );
}

/**
 * Confirm-dialog header.
 * @param className - Extra classes.
 * @returns The header wrapper.
 */
function MailConfirmDialogHeader({ className, ...props }: React.ComponentProps<"div">) {
    return (
        <div
            data-slot="mail-confirm-dialog-header"
            className={cn("flex flex-col gap-1.5 text-center sm:text-left", className)}
            {...props}
        />
    );
}

/**
 * Confirm-dialog footer (Cancel first, destructive action last).
 * @param className - Extra classes.
 * @returns The footer wrapper.
 */
function MailConfirmDialogFooter({ className, ...props }: React.ComponentProps<"div">) {
    return (
        <div
            data-slot="mail-confirm-dialog-footer"
            className={cn("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)}
            {...props}
        />
    );
}

/**
 * Confirm-dialog title.
 * @param className - Extra classes.
 * @returns The title.
 */
function MailConfirmDialogTitle({
    className,
    ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Title>) {
    return (
        <AlertDialogPrimitive.Title
            data-slot="mail-confirm-dialog-title"
            className={cn("text-lg font-semibold", className)}
            {...props}
        />
    );
}

/**
 * Confirm-dialog description.
 * @param className - Extra classes.
 * @returns The description.
 */
function MailConfirmDialogDescription({
    className,
    ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Description>) {
    return (
        <AlertDialogPrimitive.Description
            data-slot="mail-confirm-dialog-description"
            className={cn("text-muted-foreground text-sm", className)}
            {...props}
        />
    );
}

/**
 * Destructive confirm action.
 * @param className - Extra classes.
 * @returns The action button.
 */
function MailConfirmDialogAction({
    className,
    ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Action>) {
    return (
        <AlertDialogPrimitive.Action
            data-slot="mail-confirm-dialog-action"
            className={cn(
                "bg-destructive text-white inline-flex h-9 items-center justify-center rounded-md px-4 py-2 text-sm font-medium focus-visible:ring-1 focus-visible:outline-hidden disabled:pointer-events-none disabled:opacity-50",
                className
            )}
            {...props}
        />
    );
}

/**
 * Cancel action (renders first per QA §3).
 * @param className - Extra classes.
 * @returns The cancel button.
 */
function MailConfirmDialogCancel({
    className,
    ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Cancel>) {
    return (
        <AlertDialogPrimitive.Cancel
            data-slot="mail-confirm-dialog-cancel"
            className={cn(
                "border-border bg-background inline-flex h-9 items-center justify-center rounded-md border px-4 py-2 text-sm font-medium focus-visible:ring-1 focus-visible:outline-hidden disabled:pointer-events-none disabled:opacity-50",
                className
            )}
            {...props}
        />
    );
}

export {
    MailConfirmDialog,
    MailConfirmDialogContent,
    MailConfirmDialogHeader,
    MailConfirmDialogFooter,
    MailConfirmDialogTitle,
    MailConfirmDialogDescription,
    MailConfirmDialogAction,
    MailConfirmDialogCancel,
};
